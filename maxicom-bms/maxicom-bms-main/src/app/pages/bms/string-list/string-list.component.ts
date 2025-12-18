// src/app/pages/bms/string-list/string-list.component.ts
import {Component, OnInit, ViewChild, AfterViewInit, OnDestroy} from '@angular/core';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSnackBar} from '@angular/material/snack-bar';
import {finalize} from 'rxjs/operators';

// Import related files
import {
  BatteryString,
  StringFormData,
} from '../../../interfaces/string.interface';
import {StringFormComponent} from '../../../components/dialogs/string-form/string-form.component';
import {ConfirmationComponent} from '../../../components/dialogs/confirmation/confirmation.component';
import {BatteryStringService} from '../../../services/battery-string.service';
import {CommunicationService} from '../../../services/communication.service';
import {SerialPortConfig} from '../../../interfaces/communication.interface';
import {ConfigService} from '../../../services/config.service';
import {MatCard} from '@angular/material/card';

@Component({
  selector: 'app-string-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCard,
  ],
  templateUrl: './string-list.component.html',
  styleUrl: './string-list.component.scss',
})
export class StringListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = [
    'stringIndex', 'stringName', 'cellQty', 'serialPortId', 'actions'
  ];
  dataSource = new MatTableDataSource<BatteryString>([]);
  isLoading = true;
  siteName = '';

  private serialPorts: SerialPortConfig[] = [];
  private stringReloadInterval: any;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private router: Router,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private configService: ConfigService,
    private batteryStringService: BatteryStringService,
    private commService: CommunicationService
  ) {
  }

  ngOnInit(): void {
    this.siteName = this.configService.siteName;
    this.loadInitialData();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    if (this.stringReloadInterval) {
      clearInterval(this.stringReloadInterval);
    }
  }

  loadInitialData(): void {
    this.isLoading = true;
    // Get port list first
    this.commService.getSerialPortsConfig().subscribe(ports => {
      this.serialPorts = ports;
      // Then get string list
      this.loadStrings();
      
      // Auto-reload strings every 5 seconds to detect changes from other machines
      this.stringReloadInterval = setInterval(() => {
        this.batteryStringService.reloadStrings().subscribe(strings => {
          // Only update if strings list changed
          const currentIds = this.dataSource.data.map(s => s.id).sort().join(',');
          const newIds = strings.map(s => s.id).sort().join(',');
          if (currentIds !== newIds) {
            console.log('[StringList] Strings changed, updating...');
            this.dataSource.data = strings;
          }
        });
      }, 5000); // Reload every 5 seconds
    });
  }

  loadStrings(): void {
    this.isLoading = true;
    this.batteryStringService.getStrings().pipe(
      finalize(() => this.isLoading = false)
    ).subscribe(
      (data) => {
        this.dataSource.data = data;
      },
      (error) => {
        console.error('Error loading strings:', error);
      }
    );
  }

  getPortAlias(portId: string): string {
    const port = this.serialPorts.find(p => p.id === portId);
    return port ? port.alias : portId;
  }

  openStringForm(string?: BatteryString): void {
    const dialogRef = this.dialog.open(StringFormComponent, {
      width: '600px',
      data: {
        string: string ? {...string} : null,
        serialPorts: this.serialPorts, // Pass the port list to the dialog
      },
    });

    dialogRef.afterClosed().subscribe((result: StringFormData | undefined) => {
      if (!result) return;

      this.isLoading = true;
      const portConfig = this.serialPorts.find(p => p.id === result.serialPortId);
      if (!portConfig) {
        this.showMessage('Error: Selected Serial Port not found.', 'error');
        this.isLoading = false;
        return;
      }

      if (string) {
        // --- HANDLE EDIT ---
        this.batteryStringService.updateString(string.id, result, portConfig).pipe(
          finalize(() => this.isLoading = false)
        ).subscribe({
          next: () => {
            this.showMessage(`Updated ${result.stringName}`, 'success');
            this.loadStrings();
          },
          error: (err) => this.showMessage(`Error updating: ${err.message}`, 'error')
        });
      } else {
        // --- HANDLE ADD ---
        this.batteryStringService.addString(result, portConfig).pipe(
          finalize(() => this.isLoading = false)
        ).subscribe({
          next: () => {
            this.showMessage(`Added ${result.stringName}`, 'success');
            this.loadStrings();
          },
          error: (err) => this.showMessage(`Error adding: ${err.message}`, 'error')
        });
      }
    });
  }

  deleteString(string: BatteryString): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '350px',
      data: {
        title: 'Delete String',
        message: `Are you sure you want to delete "${string.stringName}"?
                  This action will delete all related API configuration.`,
        type: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.isLoading = true;
        this.batteryStringService.deleteString(string.id).pipe(
          finalize(() => this.isLoading = false)
        ).subscribe({
          next: () => {
            this.showMessage(`Deleted ${string.stringName}`, 'info');
            this.loadStrings();
          },
          error: (err) => this.showMessage(`Error deleting: ${err.message}`, 'error')
        });
      }
    });
  }

  viewStringDetail(string: BatteryString): void {
    // ID here is the config ID (e.g. 'uuid-1234')
    // String detail component will use this ID to get stringIndex
    this.router.navigate(['/setting/string', string.id]);
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [`${type}-snackbar`],
    });
  }
}
