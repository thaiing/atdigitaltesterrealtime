// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule, DatePipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, forkJoin } from 'rxjs'; // forkJoin đã có
import { OpenmucService } from '../../services/openmuc.service';
import { DashboardItem } from '../../interfaces/dashboard.interface';
import { AuthService } from '../../services/auth.service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';

// Import services
import { BatteryStringService } from '../../services/battery-string.service';
import { CommunicationService } from '../../services/communication.service';
import { SiteService } from '../../services/site.service';
import { ThermalCameraService } from '../../services/thermal-camera.service';
import { BatteryString } from '../../interfaces/string.interface';
import { ZoneTemperature } from '../../interfaces/thermal-camera.interface';
import { CellData } from '../../services/openmuc.service';
import { combineLatest, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = [
    'stringName', 'soC', 'soH', 'cellVol', 'cellRst',
    'stringVol', 'current', 'ambient',
  ];
  dataSource = new MatTableDataSource<DashboardItem>([]);
  isLoadingData = true;
  isLoadingInfo = true;

  siteName = 'Loading...';
  isEditingSiteName = false;
  siteNameControl: FormControl;
  stringPortMapping: { name: string; port: string }[] = [];

  // String cell info cards
  stringCellInfo: Array<{
    stringName: string;
    stringIndex: number;
    totalCells: number;
    lowSohCells: number;
  }> = [];
  isLoadingCellInfo = false;

  // Thermal Camera Data
  thermalZones: ZoneTemperature[] | null = null;
  isLoadingThermalCamera = true;
  private thermalCameraSubscription: Subscription | undefined;

  // Camera Stream
  isCameraEnabled = false;
  cameraStreamUrl: SafeResourceUrl | null = null;
  private readonly CAMERA_STREAM_BASE_URL = '/api/thermal-camera/stream/webrtc';
  @ViewChild('cameraWrapper') cameraWrapper!: ElementRef;
  @ViewChild('cameraIframe') cameraIframe!: ElementRef;

  private dataSubscription: Subscription | undefined;
  private stringReloadInterval: any;
  allStringConfigs: BatteryString[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private router: Router,
    private openmucService: OpenmucService,
    private authService: AuthService,
    private batteryStringService: BatteryStringService,
    private commService: CommunicationService,
    private siteService: SiteService,
    private thermalCameraService: ThermalCameraService,
    private sanitizer: DomSanitizer
  ) {
    this.siteNameControl = new FormControl('');
  }

  ngOnInit(): void {
    this.loadHeaderInfo();
    this.loadMonitoringData();
    this.loadThermalCameraData();

    // Auto-reload strings every 5 seconds to detect changes from other machines
    this.stringReloadInterval = setInterval(() => {
      this.batteryStringService.reloadStrings().subscribe(strings => {
        // Only update if strings list changed
        const currentCount = this.allStringConfigs.length;
        const newCount = strings.length;
        if (currentCount !== newCount ||
          JSON.stringify(this.allStringConfigs.map(s => s.stringIndex).sort()) !==
          JSON.stringify(strings.map(s => s.stringIndex).sort())) {
          console.log('[Dashboard] Strings changed, updating...');
          this.allStringConfigs = strings;
          // Reload header info to update string/port mapping
          this.loadHeaderInfo();
        } else {
          // Even if strings list didn't change, reload cell info to update SoH counts
          this.loadStringCellInfo(strings);
        }
      });
    }, 5000); // Reload every 5 seconds
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    if (this.stringReloadInterval) {
      clearInterval(this.stringReloadInterval);
    }
    if (this.thermalCameraSubscription) {
      this.thermalCameraSubscription.unsubscribe();
    }
  }

  /**
   * Load data for Info Header (SiteName, String/Port map)
   */
  loadHeaderInfo(): void {
    this.isLoadingInfo = true;

    // Force reload strings from API to ensure we have latest data
    // This is important when multiple machines are accessing the same system
    forkJoin({
      siteName: this.siteService.getSiteName(),
      strings: this.batteryStringService.reloadStrings(),
      // Call the corrected getSerialPortsConfig() function (gets 1 value and completes)
      ports: this.commService.getSerialPortsConfig(),
    }).subscribe(({ siteName, strings, ports }) => {
      this.siteName = siteName;
      this.siteNameControl.setValue(siteName);

      // === FIX CLICK ERROR ===
      // allStringConfigs will now be assigned a value
      this.allStringConfigs = strings;

      // Map String with Port
      this.stringPortMapping = strings.map((s) => {
        const port = ports.find((p) => p.id === s.serialPortId);
        return {
          // Use 'stringName' from config
          name: s.stringName,
          port: port ? port.alias : 'N/A',
        };
      });

      // Refresh dashboard labels with latest metadata
      this.dataSource.data = this.overrideDashboardLabels(this.dataSource.data);

      // Load cell info for all strings
      this.loadStringCellInfo(strings);

      this.isLoadingInfo = false;
    });
  }

  /**
   * Load cell information (total cells and low SoH cells) for all strings
   */
  loadStringCellInfo(strings: BatteryString[]): void {
    this.isLoadingCellInfo = true;

    if (strings.length === 0) {
      this.stringCellInfo = [];
      this.isLoadingCellInfo = false;
      return;
    }

    // Create observables for each string to get cell data
    const cellInfoObservables = strings.map(stringConfig => {
      const baseStringName = `str${stringConfig.stringIndex}`;
      const cellQty = stringConfig.cellQty || 0;

      if (cellQty <= 0) {
        return of({
          stringName: stringConfig.stringName,
          stringIndex: stringConfig.stringIndex,
          totalCells: 0,
          lowSohCells: 0
        });
      }

      return this.openmucService.getCellsData(baseStringName, cellQty).pipe(
        map((cells: CellData[]) => {
          const lowSohCells = cells.filter(cell =>
            cell.SoH !== null && cell.SoH < 80
          ).length;

          return {
            stringName: stringConfig.stringName,
            stringIndex: stringConfig.stringIndex,
            totalCells: cells.length,
            lowSohCells: lowSohCells
          };
        }),
        catchError(error => {
          console.error(`Error loading cell data for ${baseStringName}:`, error);
          return of({
            stringName: stringConfig.stringName,
            stringIndex: stringConfig.stringIndex,
            totalCells: cellQty,
            lowSohCells: 0
          });
        })
      );
    });

    // Combine all observables
    combineLatest(cellInfoObservables).subscribe({
      next: (cellInfoArray) => {
        this.stringCellInfo = cellInfoArray;
        this.isLoadingCellInfo = false;
      },
      error: (error) => {
        console.error('Error loading string cell info:', error);
        this.isLoadingCellInfo = false;
      }
    });
  }

  /**
   * Load thermal camera temperature data for all zones
   */
  loadThermalCameraData(): void {
    this.isLoadingThermalCamera = true;
    if (this.thermalCameraSubscription) {
      this.thermalCameraSubscription.unsubscribe();
    }
    this.thermalCameraSubscription = this.thermalCameraService.getThermalZonesData().subscribe({
      next: (zones) => {
        this.thermalZones = zones;
        this.isLoadingThermalCamera = false;
      },
      error: (error) => {
        console.error('Error loading thermal camera data:', error);
        this.thermalZones = null;
        this.isLoadingThermalCamera = false;
      }
    });
  }

  loadMonitoringData(): void {
    this.isLoadingData = true;
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    this.dataSubscription = this.openmucService.getDashboardStatus().subscribe(
      (data) => {
        const processedData = this.overrideDashboardLabels(data);
        this.dataSource.data = processedData;
        this.isLoadingData = false;
      },
      (error) => {
        console.error('Error loading dashboard data:', error);
        this.isLoadingData = false;
      }
    );
  }

  startEditSiteName(): void {
    this.isEditingSiteName = true;
  }

  saveSiteName(): void {
    if (this.siteNameControl.invalid) return;
    const newName = this.siteNameControl.value.trim();
    if (!newName) {
      this.authService.showMessage('Site name cannot be empty.', 'error');
      return;
    }

    this.siteService.setSiteName(newName).subscribe({
      next: () => {
        // Reload from API to ensure consistency
        this.siteService.getSiteName().subscribe({
          next: (loadedName) => {
            this.siteName = loadedName;
            this.siteNameControl.setValue(loadedName);
            this.isEditingSiteName = false;
            this.authService.showMessage('Site name updated.', 'success');
          },
          error: (err) => {
            // Even if reload fails, update local state
            this.siteName = newName;
            this.siteNameControl.setValue(newName);
            this.isEditingSiteName = false;
            this.authService.showMessage('Site name updated (but could not verify).', 'info');
            console.error('Error reloading site name after save:', err);
          }
        });
      },
      error: (err) => {
        console.error('Error saving site name:', err);
        this.authService.showMessage('Error saving site name.', 'error');
      }
    });
  }

  cancelEditSiteName(): void {
    this.siteNameControl.setValue(this.siteName);
    this.isEditingSiteName = false;
  }

  private overrideDashboardLabels(items: DashboardItem[] | undefined): DashboardItem[] {
    if (!items || items.length === 0) {
      return items ?? [];
    }

    return items.map(item => {
      const numericId = parseInt(item.id.replace(/^str/i, ''), 10);
      if (Number.isNaN(numericId)) {
        return item;
      }
      const config = this.allStringConfigs.find(cfg => cfg.stringIndex === numericId);
      if (!config) {
        return item;
      }
      return {
        ...item,
        stringName: config.stringName || item.stringName,
      };
    });
  }

  // === THIS FUNCTION WILL NOW WORK ===
  viewStringDetail(item: DashboardItem): void {
    // item.id is 'str1', 'str2',...
    const stringIndex = parseInt(item.id.replace('str', ''), 10);
    if (isNaN(stringIndex)) return;

    // Find config (already loaded in loadHeaderInfo)
    let matchingConfig = this.allStringConfigs.find(
      (c) => c.stringIndex === stringIndex
    );

    if (matchingConfig) {
      // Navigate by unique ID (uuid) with 'from' query parameter
      this.router.navigate(['/setting/string', matchingConfig.id], {
        queryParams: { from: 'dashboard' }
      });
    } else {
      // Config not found in cache, force reload from API and try again
      console.warn(`No config found for stringIndex ${stringIndex} in cache, force reloading from API...`);
      this.batteryStringService.reloadStrings().subscribe(strings => {
        this.allStringConfigs = strings;
        matchingConfig = strings.find((c) => c.stringIndex === stringIndex);

        if (matchingConfig) {
          this.router.navigate(['/setting/string', matchingConfig.id], {
            queryParams: { from: 'dashboard' }
          });
        } else {
          console.error(`No config found for stringIndex ${stringIndex} after force reload`);
          this.authService.showMessage(`Error: String ${stringIndex} has data but has not been configured. Please configure it first.`, 'error');
        }
      });
    }
  }

  getStatusClass(status: string): string {
    if (status?.toLowerCase() === 'on') {
      return 'status-dot status-on';
    } else if (status?.toLowerCase() === 'off') {
      return 'status-dot status-off';
    }
    return 'status-dot status-unknown';
  }

  // Camera Stream Controls
  toggleCamera(): void {
    this.isCameraEnabled = !this.isCameraEnabled;
    if (this.isCameraEnabled) {
      this.cameraStreamUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.CAMERA_STREAM_BASE_URL);
    } else {
      this.cameraStreamUrl = null;
    }
  }

  toggleFullscreen(): void {
    if (this.cameraWrapper?.nativeElement) {
      const wrapper = this.cameraWrapper.nativeElement;
      if (!document.fullscreenElement) {
        wrapper.requestFullscreen?.() || wrapper.webkitRequestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  }
}
