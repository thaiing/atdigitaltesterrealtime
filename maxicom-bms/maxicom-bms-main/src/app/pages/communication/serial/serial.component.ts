// src/app/pages/communication/serial/serial.component.ts
import {Component, OnInit, AfterViewInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatDialog} from '@angular/material/dialog';

// Import service and interface
import {CommunicationService} from '../../../services/communication.service';
import {SerialPortConfig} from '../../../interfaces/communication.interface';

// Import New Dialog
import {
  SerialFormComponent,
  SerialFormData,
} from '../../../components/dialogs/serial-form/serial-form.component';
import {ConfirmationComponent} from '../../../components/dialogs/confirmation/confirmation.component';

@Component({
  selector: 'app-serial',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatPaginatorModule,
  ],
  templateUrl: './serial.component.html',
  styleUrl: './serial.component.scss',
})
export class SerialComponent implements OnInit, AfterViewInit {
  isLoading = true; // Will be updated by the service
  maxPorts = 3;

  // Table configuration
  displayedColumns: string[] = [
    'name', 'baudRate', 'dataBits', 'parity', 'stopBits', 'actions'
  ];
  dataSource = new MatTableDataSource<SerialPortConfig>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private commService: CommunicationService
  ) {
  }

  ngOnInit(): void {
    // 1. Listen for loading status
    this.commService.getPortsLoadingStatus().subscribe(loading => {
      this.isLoading = loading;
    });

    // === FIX THIS FUNCTION ===
    // 2. Use 'getSerialPortsStream' to receive continuous updates
    this.commService.getSerialPortsStream().subscribe(
      (ports) => {
        this.dataSource.data = ports;
      },
      (err) => {
        console.error('Error loading Serial Ports:', err);
        this.showMessage('Could not load Serial configuration', 'error');
      }
    );
    // ===================
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  // Remove the loadSerialPorts() function as it is no longer needed

  openPortForm(portToEdit?: SerialPortConfig): void {
    const configuredPortIds = this.dataSource.data.map(p => p.id);
    
    const dialogRef = this.dialog.open(SerialFormComponent, {
      width: '500px',
      data: {
        port: portToEdit || null,
        // Pass constants to the dialog
        baudRates: this.commService.BAUD_RATES,
        dataBits: this.commService.DATA_BITS,
        stopBits: this.commService.STOP_BITS,
        parityOptions: this.commService.PARITIES,
        // Pass available ports for Add mode
        availablePorts: this.commService.getAllPortDefinitions(),
        configuredPortIds: configuredPortIds,
      },
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return; // User clicked Cancel

      if (portToEdit) {
        // --- EDIT HANDLING ---
        // Remove portId from result for edit (not needed)
        const {portId, ...editData} = result;
        this.commService.updateSerialPort(portToEdit.id, editData).subscribe(
          () => {
            this.showMessage(`Updated ${portToEdit.alias}`, 'success');
          },
          () => this.showMessage('Error while updating', 'error')
        );
      } else {
        // --- ADD HANDLING ---
        // result includes portId from form
        this.commService.addSerialPort(result).subscribe(
          (newPort) => {
            this.showMessage(`Added ${newPort.alias}`, 'success');
          },
          (err) => {
            // Display error from service
            this.showMessage(err.error?.message || 'Error when adding port', 'error');
          }
        );
      }
    });
  }

  deletePort(port: SerialPortConfig): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '350px',
      data: {
        title: 'Delete Port',
        message: `Are you sure you want to delete "${port.alias}"? This action will reset the port configuration on the device.`,
        type: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.commService.deleteSerialPort(port.id).subscribe(
          () => {
            this.showMessage(`Deleted ${port.alias}`, 'info');
            // Không cần gọi loadSerialPorts()
          },
          () => this.showMessage('Error when deleting port', 'error')
        );
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [`${type}-snackbar`],
    });
  }

  public formatParity(parity: string): string {
    if (!parity) {
      return '';
    }
    return parity.replace('PARITY_', '');
  }
}
