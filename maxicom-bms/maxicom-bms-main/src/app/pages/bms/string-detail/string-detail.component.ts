// src/app/pages/bms/string-detail/string-detail.component.ts
import {Component, OnInit, OnDestroy, ViewChildren, QueryList} from '@angular/core';
import {CommonModule, DatePipe, DecimalPipe, Location} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {Subject, of} from 'rxjs';
import {takeUntil, finalize, switchMap, tap, delay, take} from 'rxjs/operators';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTabsModule, MatTabChangeEvent} from '@angular/material/tabs';
import {MatTableModule} from '@angular/material/table';
import {MatMenuModule} from '@angular/material/menu';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';

import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartOptions, Chart, registerables} from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Services
import {BatteryStringService} from '../../../services/battery-string.service';
import {OpenmucService, StringSummaryData, CellData} from '../../../services/openmuc.service';
import {ConfigService} from '../../../services/config.service';
import {SiteService} from '../../../services/site.service';
import {ScheduleService} from '../../../services/schedule.service';
import {SohWarningService} from '../../../services/soh-warning.service';

// Interfaces
import {BatteryString} from '../../../interfaces/string.interface';
import {Schedule, ScheduleStatus, ScheduleFormData} from '../../../interfaces/schedule.interface';

// Components
import {ScheduleFormComponent} from '../../../components/dialogs/schedule-form/schedule-form.component';
import {ConfirmationComponent} from '../../../components/dialogs/confirmation/confirmation.component';

@Component({
  selector: 'app-string-detail',
  standalone: true,
  imports: [
    CommonModule, DecimalPipe, MatCardModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatProgressSpinnerModule, MatTabsModule, MatTableModule,
    MatMenuModule, MatDialogModule, MatSnackBarModule,
    BaseChartDirective,
  ],
  templateUrl: './string-detail.component.html',
  styleUrl: './string-detail.component.scss',
})
export class StringDetailComponent implements OnInit, OnDestroy {
  @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;

  // Config data
  stringConfig?: BatteryString;
  siteName = '';
  stringUuid = ''; // Renamed for clarity, this is ID (uuid) from route
  baseStringName = ''; // Backend expects strId such as str1
  scheduleLegacyStringIds: string[] = [];
  private scheduleFeaturesInitialized = false;

  // Live data
  liveHeaderData: any = {
    stringName: 'Loading...',
    cellQty: 0,
    cellBrand: '',
    cellModel: '',
  };

  // ... (stringTable and cellDataSource section remains unchanged) ...
  stringTableDisplayedColumns: string[] = [
    'stringVol', 'curr', 'maxVolId', 'minVolId', 'avgVol',
    'maxRstId', 'minRstId', 'avgRst', 'maxTempId', 'minTempId',
    'avgTemp', 'stringSoC', 'stringSoH', 'maxVoltageValue', 'minVoltageValue',
    'maxRstValue', 'minRstValue', 'maxTempValue', 'minTempValue'
  ];
  stringTableData: Partial<StringSummaryData> = {};
  stringTableDataSource = [this.stringTableData];

  cellDataSource: CellData[] = [];
  chunkedCellData: CellData[][] = [];
  private cellsPerColumn = 12;
  lowSohCellCount = 0; // Number of cells with SoH < 80% in current string

  // Schedule management
  schedules: Schedule[] = [];
  displayedScheduleColumns: string[] = ['status', 'startTime', 'endTime', 'ratedCurrent', 'soh', 'actions'];
  activeSchedule: Schedule | null = null; // Schedule đang chạy
  private scheduleCheckInterval: any;

  // ... (Chart.js configuration section remains unchanged) ...
  public chartOptionsTemplate: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Cell ID'
        }
      },
      'y-axis-l': {
        type: 'linear',
        position: 'left',
        display: true,
        grid: {
          drawOnChartArea: false,
        },
      },
      'y-axis-r': {
        type: 'linear',
        position: 'right',
        display: true,
      }
    },
    plugins: {}
  };
  public volRstChartOptions: ChartOptions;
  public volRstChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Voltage (V)',
        yAxisID: 'y-axis-l',
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.7)',
        type: 'bar',
        order: 2
      },
      {
        data: [],
        label: 'Resistance (µΩ)',
        yAxisID: 'y-axis-r',
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        fill: 'origin',
        type: 'line',
        order: 1
      }
    ]
  };
  public tempIrChartOptions: ChartOptions;
  public tempIrChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Temperature (°C)',
        yAxisID: 'y-axis-l',
        borderColor: '#F44336',
        backgroundColor: 'rgba(244, 67, 54, 0.7)',
        type: 'bar',
        order: 2
      },
      {
        data: [],
        label: 'IR (U)',
        yAxisID: 'y-axis-r',
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        fill: 'origin',
        type: 'line',
        order: 1
      }
    ]
  };
  public socSohChartOptions: ChartOptions;
  public socSohChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'SoC (%)',
        yAxisID: 'y-axis-l',
        borderColor: '#00BCD4',
        backgroundColor: 'rgba(0, 188, 212, 0.7)',
        type: 'bar',
        order: 2 // (Tuỳ chọn) Thứ tự vẽ
      },
      // 2. Đặt cấu hình Line (SoH) xuống sau -> Vẽ sau (nằm đè lên trên)
      {
        data: [],
        label: 'SoH (%)',
        yAxisID: 'y-axis-r',
        borderColor: '#9C27B0',
        backgroundColor: 'rgba(156, 39, 176, 0.1)', // Màu nền mờ
        fill: 'origin',
        type: 'line',
        order: 1 // (Tuỳ chọn) Ưu tiên hiển thị
      }
    ]
  };
  // ... (End of chart section) ...

  isLoadingConfig = true;
  activeTabIndex = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private stringService: BatteryStringService,
    private openmucService: OpenmucService,
    private configService: ConfigService,
    private siteService: SiteService,
    private scheduleService: ScheduleService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private sohWarningService: SohWarningService
  ) {
    Chart.register(...registerables);

    // Set default site name from config (will be updated from API in ngOnInit)
    this.siteName = this.configService.siteName;

    // Assign Options (remains unchanged)
    this.volRstChartOptions = {
      ...this.chartOptionsTemplate,
      scales: {
        ...this.chartOptionsTemplate.scales,
        'y-axis-l': {...this.chartOptionsTemplate.scales?.['y-axis-l'], title: {display: true, text: 'Voltage (V)'}},
        'y-axis-r': {
          ...this.chartOptionsTemplate.scales?.['y-axis-r'],
          title: {display: true, text: 'Resistance (µΩ)'}
        }
      }
    };
    this.tempIrChartOptions = {
      ...this.chartOptionsTemplate,
      scales: {
        ...this.chartOptionsTemplate.scales,
        'y-axis-l': {
          ...this.chartOptionsTemplate.scales?.['y-axis-l'],
          title: {display: true, text: 'Temperature (°C)'}
        },
        'y-axis-r': {...this.chartOptionsTemplate.scales?.['y-axis-r'], title: {display: true, text: 'IR (U)'}}
      }
    };
    this.socSohChartOptions = {
      ...this.chartOptionsTemplate,
      scales: {
        ...this.chartOptionsTemplate.scales,
        'y-axis-l': {...this.chartOptionsTemplate.scales?.['y-axis-l'], title: {display: true, text: 'SoC (%)'}},
        'y-axis-r': {...this.chartOptionsTemplate.scales?.['y-axis-r'], title: {display: true, text: 'SoH (%)'}}
      }
    };
  }

  get isLoading(): boolean {
    return this.isLoadingConfig;
  }

  ngOnInit() {
    // The param name is 'stringId' (according to app.routes.ts), but the value is 'id' (uuid)
    this.stringUuid = this.route.snapshot.paramMap.get('stringId') || '';
    if (this.stringUuid) {
      this.loadStringConfigAndData();
    }

    // Reload site name in case it was updated
    this.loadSiteName();
  }

  loadSiteName() {
    this.siteService.getSiteName().pipe(
      takeUntil(this.destroy$)
    ).subscribe(
      (name) => {
        this.siteName = name;
      },
      (error) => {
        console.error('Error loading site name:', error);
        // Fallback to config service value
        this.siteName = this.configService.siteName;
      }
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.scheduleCheckInterval) {
      clearInterval(this.scheduleCheckInterval);
    }
    
    // Remove warning when component is destroyed
    if (this.baseStringName) {
      this.sohWarningService.removeStringWarning(this.baseStringName);
    }
  }

  loadStringConfigAndData() {
    if (!this.stringUuid) return;
    this.isLoadingConfig = true;

    // Call service by 'id' (uuid)
    this.stringService.getStringById(this.stringUuid).pipe(
      takeUntil(this.destroy$),
      delay(300),
      finalize(() => this.isLoadingConfig = false)
    ).subscribe(
      (stringConfig) => {
        // === FIX ERROR HERE ===
        // Check by 'id' (uuid)
        if (!stringConfig || !stringConfig.id) {
          console.error('Config not found for string ID:', this.stringUuid);
          // Consider navigating to list page
          // void this.router.navigate(['/setting/strings']);
          return;
        }
        // ======================

        this.stringConfig = stringConfig;
        // === FIX ERROR HERE ===
        // Get baseStringName (str1, str2...) from 'stringIndex'
        const baseStringName = `str${stringConfig.stringIndex}`;
        
        // Remove warning for old string if exists
        if (this.baseStringName && this.baseStringName !== baseStringName) {
          this.sohWarningService.removeStringWarning(this.baseStringName);
        }
        
        this.baseStringName = baseStringName;
        this.scheduleLegacyStringIds = this.stringUuid ? [this.stringUuid] : [];
        // ======================

        // Seed header data directly from config/DB snapshot so UI does not rely on OpenMUC metadata
        this.liveHeaderData.stringName = stringConfig.stringName?.trim() || baseStringName;
        this.liveHeaderData.cellQty = stringConfig.cellQty || 0;
        this.liveHeaderData.cellBrand = stringConfig.cellBrand || '';
        this.liveHeaderData.cellModel = stringConfig.cellModel || '';

        // Remove loadSiteInfo logic
        this.subscribeToLiveData(baseStringName);
        this.initializeScheduleFeatures();
      }, (error) => {
        console.error('Error loading string config:', error);
      }
    );
  }

  private initializeScheduleFeatures(): void {
    if (!this.baseStringName) {
      return;
    }
    this.loadSchedules();
    this.refreshSchedulesSnapshot();
    if (!this.scheduleFeaturesInitialized) {
      this.startScheduleCheck();
      this.scheduleFeaturesInitialized = true;
    }
  }

  // ... (chunkArray, subscribeToLiveData, updateChartData remain unchanged) ...
  chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    if (size <= 0) return [array];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  /**
   * Check if SoH is below 80%
   */
  isLowSoh(soh: number | null): boolean {
    return soh !== null && soh < 80;
  }

  subscribeToLiveData(baseStringName: string) {
    const summary$ = this.openmucService.getSummaryData(baseStringName).pipe(
      tap(summary => {
        if (summary) {
          // Only override config metadata when OpenMUC returns a VALID value
          if (summary.stringName && summary.stringName.trim().length > 0) {
            this.liveHeaderData.stringName = summary.stringName.trim();
          }
          if (typeof summary.cellQty === 'number' && summary.cellQty > 0) {
          this.liveHeaderData.cellQty = summary.cellQty;
          }
          Object.assign(this.stringTableData, summary);
          this.stringTableDataSource = [...this.stringTableDataSource];
        }
      })
    );

    summary$.pipe(
      switchMap(summary => {
        const fallbackCellQty = this.stringConfig?.cellQty || 0;
        const cellQty = (summary.cellQty && summary.cellQty > 0) ? summary.cellQty : fallbackCellQty;
        this.cellsPerColumn = cellQty && cellQty > 0 ? Math.ceil(cellQty / 3) : 12;

        return cellQty && cellQty > 0
          ? this.openmucService.getCellsData(baseStringName, cellQty)
          : of([]);
      }),
      takeUntil(this.destroy$)
    ).subscribe(cells => {
      this.cellDataSource = cells;
      this.chunkedCellData = this.chunkArray(cells, this.cellsPerColumn);
      this.updateChartData(cells);
      
      // Count cells with SoH < 80%
      this.lowSohCellCount = cells.filter(cell => 
        cell.SoH !== null && cell.SoH < 80
      ).length;
      
      // Update service with warning count for this string
      if (this.baseStringName) {
        this.sohWarningService.updateStringWarningCount(
          this.baseStringName, 
          this.lowSohCellCount
        );
      }
    });
  }

  updateChartData(cells: CellData[]) {
    const labels = cells.map(c => `${c.ID}`);
    this.volRstChartData.labels = labels;
    this.tempIrChartData.labels = labels;
    this.socSohChartData.labels = labels;
    this.volRstChartData.datasets[0].data = cells.map(c => c.Vol ?? 0);
    this.volRstChartData.datasets[1].data = cells.map(c => c.Rst ?? 0);
    this.tempIrChartData.datasets[0].data = cells.map(c => c.Temp ?? 0);
    this.tempIrChartData.datasets[1].data = cells.map(c => c.IR ?? 0);
    this.socSohChartData.datasets[0].data = cells.map(c => c.SoC ?? 0);
    this.socSohChartData.datasets[1].data = cells.map(c => c.SoH ?? 0);
    this.charts?.forEach(chart => {
      chart.update();
    });
  }

  // Remove refreshData()

  exportData() {
    // Hiển thị menu để chọn loại export
    const exportType = prompt('Chọn loại export:\n1. Vol_Rst (U_IR)\n2. T_IR (Temp)\nNhập số (1 hoặc 2):');

    if (!exportType) return;

    switch (exportType) {
      case '1':
        this.exportVolRstPDF();
        break;
      case '2':
        this.exportTIRPDF();
        break;
      default:
        console.warn('Invalid export type');
    }
  }

  exportVolRstPDF() {
    const doc = new jsPDF('portrait');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Helper function to add footer
    const addFooter = (pageNum: number, totalPages: number) => {
      const footerY = pageHeight - 10;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const reportDate = new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Report generated: ${reportDate}`, margin, footerY);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, footerY, {align: 'right'});
    };

    // Title Section
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Realtime Data', pageWidth / 2, 20, {align: 'center'});

    // Horizontal line under title
    doc.setDrawColor(1, 37, 150);
    doc.setLineWidth(0.5);
    doc.line(margin, 23, pageWidth - margin, 23);

    // Header Info Section - 2 columns layout
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    let yPos = 32;

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Site Name:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(this.siteName, margin + 35, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('String Name:', margin, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.stringName || 'N/A', margin + 35, yPos + 6);

    // Right column
    const updateTime = this.stringTableData.updateTime
      ? new Date(this.stringTableData.updateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : new Date().toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-');

    doc.setFont('helvetica', 'bold');
    doc.text('Update Time:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(updateTime, pageWidth / 2 + 45, yPos);

    const rstUpdateTime = this.stringTableData.rstUpdateTime
      ? new Date(this.stringTableData.rstUpdateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : 'N/A';

    doc.setFont('helvetica', 'bold');
    doc.text('Rst Update Time:', pageWidth / 2 + 10, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(rstUpdateTime, pageWidth / 2 + 45, yPos + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Cell Qty:', margin, yPos + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.cellQty.toString(), margin + 35, yPos + 12);

    yPos += 20;

    // String Metrics Table - Chỉ lấy các field có trong data
    const stringMetricsHeaders: string[] = [];
    const stringMetricsValues: any[] = [];

    // Chỉ thêm các field có giá trị
    if (this.stringTableData.totalVoltage !== null && this.stringTableData.totalVoltage !== undefined) {
      stringMetricsHeaders.push('String Vol(V)');
      stringMetricsValues.push(this.stringTableData.totalVoltage.toFixed(0));
    }

    if (this.stringTableData.stringCurrent !== null && this.stringTableData.stringCurrent !== undefined) {
      stringMetricsHeaders.push('Current(A)');
      stringMetricsValues.push(this.stringTableData.stringCurrent.toFixed(0));
    }

    if (this.stringTableData.maxVolId !== null && this.stringTableData.maxVolId !== undefined) {
      stringMetricsHeaders.push('Max Vol ID');
      stringMetricsValues.push(this.stringTableData.maxVolId.toString());
    }

    if (this.stringTableData.minVolId !== null && this.stringTableData.minVolId !== undefined) {
      stringMetricsHeaders.push('Min Vol ID');
      stringMetricsValues.push(this.stringTableData.minVolId.toString());
    }

    if (this.stringTableData.avgVoltage !== null && this.stringTableData.avgVoltage !== undefined) {
      stringMetricsHeaders.push('Avg Vol(V)');
      stringMetricsValues.push(this.stringTableData.avgVoltage.toFixed(3));
    }

    if (this.stringTableData.maxRstId !== null && this.stringTableData.maxRstId !== undefined) {
      stringMetricsHeaders.push('Max Rst ID');
      stringMetricsValues.push(this.stringTableData.maxRstId.toString());
    }

    if (this.stringTableData.minRstId !== null && this.stringTableData.minRstId !== undefined) {
      stringMetricsHeaders.push('Min Rst ID');
      stringMetricsValues.push(this.stringTableData.minRstId.toString());
    }

    if (this.stringTableData.avgRst !== null && this.stringTableData.avgRst !== undefined) {
      stringMetricsHeaders.push('Avg Rst(µOhm)');
      stringMetricsValues.push(this.stringTableData.avgRst.toFixed(0));
    }

    if (this.stringTableData.maxTempId !== null && this.stringTableData.maxTempId !== undefined) {
      stringMetricsHeaders.push('Max Temp ID');
      stringMetricsValues.push(this.stringTableData.maxTempId.toString());
    }

    if (this.stringTableData.minTempId !== null && this.stringTableData.minTempId !== undefined) {
      stringMetricsHeaders.push('Min Temp ID');
      stringMetricsValues.push(this.stringTableData.minTempId.toString());
    }

    if (this.stringTableData.avgTemp !== null && this.stringTableData.avgTemp !== undefined) {
      stringMetricsHeaders.push('Avg Temp(°C)');
      stringMetricsValues.push(this.stringTableData.avgTemp.toFixed(1));
    }

    if (this.stringTableData.stringSoC !== null && this.stringTableData.stringSoC !== undefined) {
      stringMetricsHeaders.push('String SoC(%)');
      stringMetricsValues.push(this.stringTableData.stringSoC.toFixed(0));
    }

    if (this.stringTableData.stringSoH !== null && this.stringTableData.stringSoH !== undefined) {
      stringMetricsHeaders.push('String SoH(%)');
      stringMetricsValues.push(this.stringTableData.stringSoH.toFixed(0));
    }

    if (this.stringTableData.maxVoltageValue !== null && this.stringTableData.maxVoltageValue !== undefined) {
      stringMetricsHeaders.push('Max Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.maxVoltageValue.toFixed(3));
    }

    if (this.stringTableData.minVoltageValue !== null && this.stringTableData.minVoltageValue !== undefined) {
      stringMetricsHeaders.push('Min Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.minVoltageValue.toFixed(3));
    }

    if (this.stringTableData.maxRstValue !== null && this.stringTableData.maxRstValue !== undefined) {
      stringMetricsHeaders.push('Max Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.maxRstValue.toFixed(3));
    }

    if (this.stringTableData.minRstValue !== null && this.stringTableData.minRstValue !== undefined) {
      stringMetricsHeaders.push('Min Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.minRstValue.toFixed(3));
    }

    if (this.stringTableData.maxTempValue !== null && this.stringTableData.maxTempValue !== undefined) {
      stringMetricsHeaders.push('Max Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.maxTempValue.toFixed(1));
    }

    if (this.stringTableData.minTempValue !== null && this.stringTableData.minTempValue !== undefined) {
      stringMetricsHeaders.push('Min Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.minTempValue.toFixed(1));
    }

    // Section Title: String Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('String Summary', margin, yPos);
    yPos += 8;

    // Chia String Metrics Table thành 2 hàng nếu có quá nhiều cột (> 10)
    if (stringMetricsHeaders.length > 0) {
      const midPoint = Math.ceil(stringMetricsHeaders.length / 2);

      if (stringMetricsHeaders.length > 10) {
        // Chia thành 2 hàng
        const firstRowHeaders = stringMetricsHeaders.slice(0, midPoint);
        const firstRowValues = stringMetricsValues.slice(0, midPoint);
        const secondRowHeaders = stringMetricsHeaders.slice(midPoint);
        const secondRowValues = stringMetricsValues.slice(midPoint);

        // Hàng 1
        autoTable(doc, {
          head: [firstRowHeaders],
          body: [firstRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });

        yPos = (doc as any).lastAutoTable.finalY + 8;

        // Hàng 2
        autoTable(doc, {
          head: [secondRowHeaders],
          body: [secondRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      } else {
        // Chỉ 1 hàng
        autoTable(doc, {
          head: [stringMetricsHeaders],
          body: [stringMetricsValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      }

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Section Title: Cell Data
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Cell Data (Voltage & Resistance)', margin, yPos);
    yPos += 8;

    // Cells Table - Format: ID | Vol(V) | Rst(µΩ) | ID | Vol(V) | Rst(µΩ)
    const totalCells = this.cellDataSource.length;
    if (totalCells === 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('No cell data available', margin, yPos);
      const totalPages = doc.internal.pages.length - 1;
      addFooter(1, totalPages);
      doc.save(`U_IR ${this.liveHeaderData.stringName}.pdf`);
      return;
    }

    // Chia cells thành các nhóm 2 (mỗi nhóm = 1 hàng với 2 cells)
    const cellsPerRow = 2; // 2 cells mỗi hàng (ID Vol Rst | ID Vol Rst)
    const totalRows = Math.ceil(totalCells / cellsPerRow);

    // Tạo table data với format: ID | Vol(V) | Rst(µΩ) | ID | Vol(V) | Rst(µΩ)
    const tableData: any[] = [];
    for (let i = 0; i < totalRows; i++) {
      const row: any[] = [];
      for (let j = 0; j < cellsPerRow; j++) {
        const cellIndex = i * cellsPerRow + j;
        if (cellIndex < totalCells) {
          const cell = this.cellDataSource[cellIndex];
          row.push(
            cell.ID.toString(),
            cell.Vol !== null ? cell.Vol.toFixed(3) : 'N/A',
            cell.Rst !== null ? cell.Rst.toFixed(0) : 'N/A'
          );
        } else {
          // Điền empty nếu không đủ 2 cells
          row.push('', '', '');
        }
      }
      tableData.push(row);
    }

    // Header: ID | Vol(V) | Rst(µΩ) | ID | Vol(V) | Rst(µΩ)
    const tableHeaders = ['ID', 'Vol(V)', 'Rst(µOhm)', 'ID', 'Vol(V)', 'Rst(µOhm)'];

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: yPos,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [1, 37, 150],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      columnStyles: {
        0: {halign: 'center'}, // ID
        1: {halign: 'right'},   // Vol
        2: {halign: 'right'},   // Rst
        3: {halign: 'center'}, // ID
        4: {halign: 'right'},  // Vol
        5: {halign: 'right'}   // Rst
      },
      margin: {left: margin, right: margin},
      theme: 'grid',
      didDrawPage: (data: any) => {
        // Add footer on each page
        const pageNum = doc.internal.pages.length - 1;
        const totalPages = pageNum;
        addFooter(pageNum, totalPages);
      }
    });

    // Add footer to last page
    const totalPages = doc.internal.pages.length - 1;
    addFooter(totalPages, totalPages);

    // Save PDF
    const fileName = `U_IR ${this.liveHeaderData.stringName}.pdf`;
    doc.save(fileName);
  }

  exportTIRPDF() {
    const doc = new jsPDF('portrait');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Helper function to add footer
    const addFooter = (pageNum: number, totalPages: number) => {
      const footerY = pageHeight - 10;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const reportDate = new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Report generated: ${reportDate}`, margin, footerY);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, footerY, {align: 'right'});
    };

    // Title Section
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Realtime Data', pageWidth / 2, 20, {align: 'center'});

    // Horizontal line under title
    doc.setDrawColor(1, 37, 150);
    doc.setLineWidth(0.5);
    doc.line(margin, 23, pageWidth - margin, 23);

    // Header Info Section - 2 columns layout
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    let yPos = 32;

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Site Name:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(this.siteName, margin + 35, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('String Name:', margin, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.stringName || 'N/A', margin + 35, yPos + 6);

    // Right column
    const updateTime = this.stringTableData.updateTime
      ? new Date(this.stringTableData.updateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : new Date().toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-');

    doc.setFont('helvetica', 'bold');
    doc.text('Update Time:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(updateTime, pageWidth / 2 + 45, yPos);

    const rstUpdateTime = this.stringTableData.rstUpdateTime
      ? new Date(this.stringTableData.rstUpdateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : 'N/A';

    doc.setFont('helvetica', 'bold');
    doc.text('Rst Update Time:', pageWidth / 2 + 10, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(rstUpdateTime, pageWidth / 2 + 45, yPos + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Cell Qty:', margin, yPos + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.cellQty.toString(), margin + 35, yPos + 12);

    yPos += 20;

    // String Metrics Table - Chỉ lấy các field có trong data (giống Vol_Rst)
    const stringMetricsHeaders: string[] = [];
    const stringMetricsValues: any[] = [];

    // Chỉ thêm các field có giá trị (giống như Vol_Rst)
    if (this.stringTableData.totalVoltage !== null && this.stringTableData.totalVoltage !== undefined) {
      stringMetricsHeaders.push('String Vol(V)');
      stringMetricsValues.push(this.stringTableData.totalVoltage.toFixed(0));
    }

    if (this.stringTableData.stringCurrent !== null && this.stringTableData.stringCurrent !== undefined) {
      stringMetricsHeaders.push('Current(A)');
      stringMetricsValues.push(this.stringTableData.stringCurrent.toFixed(0));
    }

    if (this.stringTableData.maxVolId !== null && this.stringTableData.maxVolId !== undefined) {
      stringMetricsHeaders.push('Max Vol ID');
      stringMetricsValues.push(this.stringTableData.maxVolId.toString());
    }

    if (this.stringTableData.minVolId !== null && this.stringTableData.minVolId !== undefined) {
      stringMetricsHeaders.push('Min Vol ID');
      stringMetricsValues.push(this.stringTableData.minVolId.toString());
    }

    if (this.stringTableData.avgVoltage !== null && this.stringTableData.avgVoltage !== undefined) {
      stringMetricsHeaders.push('Avg Vol(V)');
      stringMetricsValues.push(this.stringTableData.avgVoltage.toFixed(3));
    }

    if (this.stringTableData.maxRstId !== null && this.stringTableData.maxRstId !== undefined) {
      stringMetricsHeaders.push('Max Rst ID');
      stringMetricsValues.push(this.stringTableData.maxRstId.toString());
    }

    if (this.stringTableData.minRstId !== null && this.stringTableData.minRstId !== undefined) {
      stringMetricsHeaders.push('Min Rst ID');
      stringMetricsValues.push(this.stringTableData.minRstId.toString());
    }

    if (this.stringTableData.avgRst !== null && this.stringTableData.avgRst !== undefined) {
      stringMetricsHeaders.push('Avg Rst(µOhm)');
      stringMetricsValues.push(this.stringTableData.avgRst.toFixed(0));
    }

    if (this.stringTableData.maxTempId !== null && this.stringTableData.maxTempId !== undefined) {
      stringMetricsHeaders.push('Max Temp ID');
      stringMetricsValues.push(this.stringTableData.maxTempId.toString());
    }

    if (this.stringTableData.minTempId !== null && this.stringTableData.minTempId !== undefined) {
      stringMetricsHeaders.push('Min Temp ID');
      stringMetricsValues.push(this.stringTableData.minTempId.toString());
    }

    if (this.stringTableData.avgTemp !== null && this.stringTableData.avgTemp !== undefined) {
      stringMetricsHeaders.push('Avg Temp(°C)');
      stringMetricsValues.push(this.stringTableData.avgTemp.toFixed(1));
    }

    if (this.stringTableData.stringSoC !== null && this.stringTableData.stringSoC !== undefined) {
      stringMetricsHeaders.push('String SoC(%)');
      stringMetricsValues.push(this.stringTableData.stringSoC.toFixed(0));
    }

    if (this.stringTableData.stringSoH !== null && this.stringTableData.stringSoH !== undefined) {
      stringMetricsHeaders.push('String SoH(%)');
      stringMetricsValues.push(this.stringTableData.stringSoH.toFixed(0));
    }

    if (this.stringTableData.maxVoltageValue !== null && this.stringTableData.maxVoltageValue !== undefined) {
      stringMetricsHeaders.push('Max Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.maxVoltageValue.toFixed(3));
    }

    if (this.stringTableData.minVoltageValue !== null && this.stringTableData.minVoltageValue !== undefined) {
      stringMetricsHeaders.push('Min Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.minVoltageValue.toFixed(3));
    }

    if (this.stringTableData.maxRstValue !== null && this.stringTableData.maxRstValue !== undefined) {
      stringMetricsHeaders.push('Max Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.maxRstValue.toFixed(3));
    }

    if (this.stringTableData.minRstValue !== null && this.stringTableData.minRstValue !== undefined) {
      stringMetricsHeaders.push('Min Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.minRstValue.toFixed(3));
    }

    if (this.stringTableData.maxTempValue !== null && this.stringTableData.maxTempValue !== undefined) {
      stringMetricsHeaders.push('Max Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.maxTempValue.toFixed(1));
    }

    if (this.stringTableData.minTempValue !== null && this.stringTableData.minTempValue !== undefined) {
      stringMetricsHeaders.push('Min Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.minTempValue.toFixed(1));
    }

    // Section Title: String Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('String Summary', margin, yPos);
    yPos += 8;

    // Chia String Metrics Table thành 2 hàng nếu có quá nhiều cột (> 10)
    if (stringMetricsHeaders.length > 0) {
      const midPoint = Math.ceil(stringMetricsHeaders.length / 2);

      if (stringMetricsHeaders.length > 10) {
        // Chia thành 2 hàng
        const firstRowHeaders = stringMetricsHeaders.slice(0, midPoint);
        const firstRowValues = stringMetricsValues.slice(0, midPoint);
        const secondRowHeaders = stringMetricsHeaders.slice(midPoint);
        const secondRowValues = stringMetricsValues.slice(midPoint);

        // Hàng 1
        autoTable(doc, {
          head: [firstRowHeaders],
          body: [firstRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });

        yPos = (doc as any).lastAutoTable.finalY + 8;

        // Hàng 2
        autoTable(doc, {
          head: [secondRowHeaders],
          body: [secondRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      } else {
        // Chỉ 1 hàng
        autoTable(doc, {
          head: [stringMetricsHeaders],
          body: [stringMetricsValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      }

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Section Title: Cell Data
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Cell Data (Temperature & IR)', margin, yPos);
    yPos += 8;

    // Cells Table - Format: ID | Temp(°C) | IR(U) | ID | Temp(°C) | IR(U)
    const totalCells = this.cellDataSource.length;
    if (totalCells === 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('No cell data available', margin, yPos);
      const totalPages = doc.internal.pages.length - 1;
      addFooter(1, totalPages);
      doc.save(`Temp ${this.liveHeaderData.stringName}.pdf`);
      return;
    }

    // Chia cells thành các nhóm 2 (mỗi nhóm = 1 hàng với 2 cells)
    const cellsPerRow = 2; // 2 cells mỗi hàng (ID Temp IR | ID Temp IR)
    const totalRows = Math.ceil(totalCells / cellsPerRow);

    // Tạo table data với format: ID | Temp(°C) | IR(U) | ID | Temp(°C) | IR(U)
    const tableData: any[] = [];
    for (let i = 0; i < totalRows; i++) {
      const row: any[] = [];
      for (let j = 0; j < cellsPerRow; j++) {
        const cellIndex = i * cellsPerRow + j;
        if (cellIndex < totalCells) {
          const cell = this.cellDataSource[cellIndex];
          row.push(
            cell.ID.toString(),
            cell.Temp !== null ? cell.Temp.toFixed(1) : 'N/A',
            cell.IR !== null ? cell.IR.toFixed(3) : 'N/A'
          );
        } else {
          // Điền empty nếu không đủ 2 cells
          row.push('', '', '');
        }
      }
      tableData.push(row);
    }

    // Header: ID | Temp(°C) | IR(U) | ID | Temp(°C) | IR(U)
    const tableHeaders = ['ID', 'Temp(°C)', 'IR(U)', 'ID', 'Temp(°C)', 'IR(U)'];

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: yPos,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [1, 37, 150],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      columnStyles: {
        0: {halign: 'center'}, // ID
        1: {halign: 'right'},  // Temp
        2: {halign: 'right'},  // IR
        3: {halign: 'center'}, // ID
        4: {halign: 'right'}, // Temp
        5: {halign: 'right'}  // IR
      },
      margin: {left: margin, right: margin},
      theme: 'grid',
      didDrawPage: (data: any) => {
        // Add footer on each page
        const pageNum = doc.internal.pages.length - 1;
        const totalPages = pageNum;
        addFooter(pageNum, totalPages);
      }
    });

    // Add footer to last page
    const totalPages = doc.internal.pages.length - 1;
    addFooter(totalPages, totalPages);

    // Save PDF
    const fileName = `Temp ${this.liveHeaderData.stringName}.pdf`;
    doc.save(fileName);
  }

  printData() {
    // Hiển thị menu để chọn loại print
    const printType = prompt('Chọn loại print:\n1. Vol_Rst (U_IR)\n2. T_IR (Temp)\nNhập số (1 hoặc 2):');

    if (!printType) return;

    switch (printType) {
      case '1':
        this.printVolRstPDF();
        break;
      case '2':
        this.printTIRPDF();
        break;
      default:
        console.warn('Invalid print type');
    }
  }

  printVolRstPDF() {
    const doc = new jsPDF('portrait');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Helper function to add footer
    const addFooter = (pageNum: number, totalPages: number) => {
      const footerY = pageHeight - 10;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const reportDate = new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Report generated: ${reportDate}`, margin, footerY);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, footerY, {align: 'right'});
    };

    // Title Section
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Realtime Data', pageWidth / 2, 20, {align: 'center'});

    // Horizontal line under title
    doc.setDrawColor(1, 37, 150);
    doc.setLineWidth(0.5);
    doc.line(margin, 23, pageWidth - margin, 23);

    // Header Info Section - 2 columns layout
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    let yPos = 32;

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Site Name:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(this.siteName, margin + 35, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('String Name:', margin, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.stringName || 'N/A', margin + 35, yPos + 6);

    // Right column
    const updateTime = this.stringTableData.updateTime
      ? new Date(this.stringTableData.updateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : new Date().toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-');

    doc.setFont('helvetica', 'bold');
    doc.text('Update Time:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(updateTime, pageWidth / 2 + 45, yPos);

    const rstUpdateTime = this.stringTableData.rstUpdateTime
      ? new Date(this.stringTableData.rstUpdateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : 'N/A';

    doc.setFont('helvetica', 'bold');
    doc.text('Rst Update Time:', pageWidth / 2 + 10, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(rstUpdateTime, pageWidth / 2 + 45, yPos + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Cell Qty:', margin, yPos + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.cellQty.toString(), margin + 35, yPos + 12);

    yPos += 20;

    // String Metrics Table - Same as exportVolRstPDF
    const stringMetricsHeaders: string[] = [];
    const stringMetricsValues: any[] = [];

    if (this.stringTableData.totalVoltage !== null && this.stringTableData.totalVoltage !== undefined) {
      stringMetricsHeaders.push('String Vol(V)');
      stringMetricsValues.push(this.stringTableData.totalVoltage.toFixed(0));
    }

    if (this.stringTableData.stringCurrent !== null && this.stringTableData.stringCurrent !== undefined) {
      stringMetricsHeaders.push('Current(A)');
      stringMetricsValues.push(this.stringTableData.stringCurrent.toFixed(0));
    }

    if (this.stringTableData.maxVolId !== null && this.stringTableData.maxVolId !== undefined) {
      stringMetricsHeaders.push('Max Vol ID');
      stringMetricsValues.push(this.stringTableData.maxVolId.toString());
    }

    if (this.stringTableData.minVolId !== null && this.stringTableData.minVolId !== undefined) {
      stringMetricsHeaders.push('Min Vol ID');
      stringMetricsValues.push(this.stringTableData.minVolId.toString());
    }

    if (this.stringTableData.avgVoltage !== null && this.stringTableData.avgVoltage !== undefined) {
      stringMetricsHeaders.push('Avg Vol(V)');
      stringMetricsValues.push(this.stringTableData.avgVoltage.toFixed(3));
    }

    if (this.stringTableData.maxRstId !== null && this.stringTableData.maxRstId !== undefined) {
      stringMetricsHeaders.push('Max Rst ID');
      stringMetricsValues.push(this.stringTableData.maxRstId.toString());
    }

    if (this.stringTableData.minRstId !== null && this.stringTableData.minRstId !== undefined) {
      stringMetricsHeaders.push('Min Rst ID');
      stringMetricsValues.push(this.stringTableData.minRstId.toString());
    }

    if (this.stringTableData.avgRst !== null && this.stringTableData.avgRst !== undefined) {
      stringMetricsHeaders.push('Avg Rst(µOhm)');
      stringMetricsValues.push(this.stringTableData.avgRst.toFixed(0));
    }

    if (this.stringTableData.maxTempId !== null && this.stringTableData.maxTempId !== undefined) {
      stringMetricsHeaders.push('Max Temp ID');
      stringMetricsValues.push(this.stringTableData.maxTempId.toString());
    }

    if (this.stringTableData.minTempId !== null && this.stringTableData.minTempId !== undefined) {
      stringMetricsHeaders.push('Min Temp ID');
      stringMetricsValues.push(this.stringTableData.minTempId.toString());
    }

    if (this.stringTableData.avgTemp !== null && this.stringTableData.avgTemp !== undefined) {
      stringMetricsHeaders.push('Avg Temp(°C)');
      stringMetricsValues.push(this.stringTableData.avgTemp.toFixed(1));
    }

    if (this.stringTableData.stringSoC !== null && this.stringTableData.stringSoC !== undefined) {
      stringMetricsHeaders.push('String SoC(%)');
      stringMetricsValues.push(this.stringTableData.stringSoC.toFixed(0));
    }

    if (this.stringTableData.stringSoH !== null && this.stringTableData.stringSoH !== undefined) {
      stringMetricsHeaders.push('String SoH(%)');
      stringMetricsValues.push(this.stringTableData.stringSoH.toFixed(0));
    }

    if (this.stringTableData.maxVoltageValue !== null && this.stringTableData.maxVoltageValue !== undefined) {
      stringMetricsHeaders.push('Max Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.maxVoltageValue.toFixed(3));
    }

    if (this.stringTableData.minVoltageValue !== null && this.stringTableData.minVoltageValue !== undefined) {
      stringMetricsHeaders.push('Min Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.minVoltageValue.toFixed(3));
    }

    if (this.stringTableData.maxRstValue !== null && this.stringTableData.maxRstValue !== undefined) {
      stringMetricsHeaders.push('Max Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.maxRstValue.toFixed(3));
    }

    if (this.stringTableData.minRstValue !== null && this.stringTableData.minRstValue !== undefined) {
      stringMetricsHeaders.push('Min Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.minRstValue.toFixed(3));
    }

    if (this.stringTableData.maxTempValue !== null && this.stringTableData.maxTempValue !== undefined) {
      stringMetricsHeaders.push('Max Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.maxTempValue.toFixed(1));
    }

    if (this.stringTableData.minTempValue !== null && this.stringTableData.minTempValue !== undefined) {
      stringMetricsHeaders.push('Min Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.minTempValue.toFixed(1));
    }

    // Section Title: String Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('String Summary', margin, yPos);
    yPos += 8;

    // Chia String Metrics Table thành 2 hàng nếu có quá nhiều cột (> 10)
    if (stringMetricsHeaders.length > 0) {
      const midPoint = Math.ceil(stringMetricsHeaders.length / 2);

      if (stringMetricsHeaders.length > 10) {
        const firstRowHeaders = stringMetricsHeaders.slice(0, midPoint);
        const firstRowValues = stringMetricsValues.slice(0, midPoint);
        const secondRowHeaders = stringMetricsHeaders.slice(midPoint);
        const secondRowValues = stringMetricsValues.slice(midPoint);

        autoTable(doc, {
          head: [firstRowHeaders],
          body: [firstRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });

        yPos = (doc as any).lastAutoTable.finalY + 8;

        autoTable(doc, {
          head: [secondRowHeaders],
          body: [secondRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      } else {
        autoTable(doc, {
          head: [stringMetricsHeaders],
          body: [stringMetricsValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      }

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Section Title: Cell Data
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Cell Data (Voltage & Resistance)', margin, yPos);
    yPos += 8;

    const totalCells = this.cellDataSource.length;
    if (totalCells === 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('No cell data available', margin, yPos);
      const totalPages = doc.internal.pages.length - 1;
      addFooter(1, totalPages);
      doc.autoPrint();
      window.open(URL.createObjectURL(doc.output('blob')), '_blank');
      return;
    }

    const cellsPerRow = 2;
    const totalRows = Math.ceil(totalCells / cellsPerRow);

    const tableData: any[] = [];
    for (let i = 0; i < totalRows; i++) {
      const row: any[] = [];
      for (let j = 0; j < cellsPerRow; j++) {
        const cellIndex = i * cellsPerRow + j;
        if (cellIndex < totalCells) {
          const cell = this.cellDataSource[cellIndex];
          row.push(
            cell.ID.toString(),
            cell.Vol !== null ? cell.Vol.toFixed(3) : 'N/A',
            cell.Rst !== null ? cell.Rst.toFixed(0) : 'N/A'
          );
        } else {
          row.push('', '', '');
        }
      }
      tableData.push(row);
    }

    const tableHeaders = ['ID', 'Vol(V)', 'Rst(µOhm)', 'ID', 'Vol(V)', 'Rst(µOhm)'];

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: yPos,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [1, 37, 150],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      columnStyles: {
        0: {halign: 'center'},
        1: {halign: 'right'},
        2: {halign: 'right'},
        3: {halign: 'center'},
        4: {halign: 'right'},
        5: {halign: 'right'}
      },
      margin: {left: margin, right: margin},
      theme: 'grid',
      didDrawPage: (data: any) => {
        const pageNum = doc.internal.pages.length - 1;
        const totalPages = pageNum;
        addFooter(pageNum, totalPages);
      }
    });

    const totalPages = doc.internal.pages.length - 1;
    addFooter(totalPages, totalPages);

    // Auto print and open in new window
    doc.autoPrint();
    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  }

  printTIRPDF() {
    // Similar to printVolRstPDF but for T_IR data
    // Copy the same structure from exportTIRPDF but use autoPrint instead of save
    const doc = new jsPDF('portrait');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const addFooter = (pageNum: number, totalPages: number) => {
      const footerY = pageHeight - 10;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const reportDate = new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Report generated: ${reportDate}`, margin, footerY);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, footerY, {align: 'right'});
    };

    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Realtime Data', pageWidth / 2, 20, {align: 'center'});

    doc.setDrawColor(1, 37, 150);
    doc.setLineWidth(0.5);
    doc.line(margin, 23, pageWidth - margin, 23);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    let yPos = 32;

    doc.setFont('helvetica', 'bold');
    doc.text('Site Name:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(this.siteName, margin + 35, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('String Name:', margin, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.stringName || 'N/A', margin + 35, yPos + 6);

    const updateTime = this.stringTableData.updateTime
      ? new Date(this.stringTableData.updateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : new Date().toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-');

    doc.setFont('helvetica', 'bold');
    doc.text('Update Time:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(updateTime, pageWidth / 2 + 45, yPos);

    const rstUpdateTime = this.stringTableData.rstUpdateTime
      ? new Date(this.stringTableData.rstUpdateTime).toLocaleString('vi-VN', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).replace(/\//g, '-')
      : 'N/A';

    doc.setFont('helvetica', 'bold');
    doc.text('Rst Update Time:', pageWidth / 2 + 10, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(rstUpdateTime, pageWidth / 2 + 45, yPos + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Cell Qty:', margin, yPos + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.liveHeaderData.cellQty.toString(), margin + 35, yPos + 12);

    yPos += 20;

    // String Metrics Table - Same as exportTIRPDF
    const stringMetricsHeaders: string[] = [];
    const stringMetricsValues: any[] = [];

    if (this.stringTableData.totalVoltage !== null && this.stringTableData.totalVoltage !== undefined) {
      stringMetricsHeaders.push('String Vol(V)');
      stringMetricsValues.push(this.stringTableData.totalVoltage.toFixed(0));
    }

    if (this.stringTableData.stringCurrent !== null && this.stringTableData.stringCurrent !== undefined) {
      stringMetricsHeaders.push('Current(A)');
      stringMetricsValues.push(this.stringTableData.stringCurrent.toFixed(0));
    }

    if (this.stringTableData.maxVolId !== null && this.stringTableData.maxVolId !== undefined) {
      stringMetricsHeaders.push('Max Vol ID');
      stringMetricsValues.push(this.stringTableData.maxVolId.toString());
    }

    if (this.stringTableData.minVolId !== null && this.stringTableData.minVolId !== undefined) {
      stringMetricsHeaders.push('Min Vol ID');
      stringMetricsValues.push(this.stringTableData.minVolId.toString());
    }

    if (this.stringTableData.avgVoltage !== null && this.stringTableData.avgVoltage !== undefined) {
      stringMetricsHeaders.push('Avg Vol(V)');
      stringMetricsValues.push(this.stringTableData.avgVoltage.toFixed(3));
    }

    if (this.stringTableData.maxRstId !== null && this.stringTableData.maxRstId !== undefined) {
      stringMetricsHeaders.push('Max Rst ID');
      stringMetricsValues.push(this.stringTableData.maxRstId.toString());
    }

    if (this.stringTableData.minRstId !== null && this.stringTableData.minRstId !== undefined) {
      stringMetricsHeaders.push('Min Rst ID');
      stringMetricsValues.push(this.stringTableData.minRstId.toString());
    }

    if (this.stringTableData.avgRst !== null && this.stringTableData.avgRst !== undefined) {
      stringMetricsHeaders.push('Avg Rst(µOhm)');
      stringMetricsValues.push(this.stringTableData.avgRst.toFixed(0));
    }

    if (this.stringTableData.maxTempId !== null && this.stringTableData.maxTempId !== undefined) {
      stringMetricsHeaders.push('Max Temp ID');
      stringMetricsValues.push(this.stringTableData.maxTempId.toString());
    }

    if (this.stringTableData.minTempId !== null && this.stringTableData.minTempId !== undefined) {
      stringMetricsHeaders.push('Min Temp ID');
      stringMetricsValues.push(this.stringTableData.minTempId.toString());
    }

    if (this.stringTableData.avgTemp !== null && this.stringTableData.avgTemp !== undefined) {
      stringMetricsHeaders.push('Avg Temp(°C)');
      stringMetricsValues.push(this.stringTableData.avgTemp.toFixed(1));
    }

    if (this.stringTableData.stringSoC !== null && this.stringTableData.stringSoC !== undefined) {
      stringMetricsHeaders.push('String SoC(%)');
      stringMetricsValues.push(this.stringTableData.stringSoC.toFixed(0));
    }

    if (this.stringTableData.stringSoH !== null && this.stringTableData.stringSoH !== undefined) {
      stringMetricsHeaders.push('String SoH(%)');
      stringMetricsValues.push(this.stringTableData.stringSoH.toFixed(0));
    }

    if (this.stringTableData.maxVoltageValue !== null && this.stringTableData.maxVoltageValue !== undefined) {
      stringMetricsHeaders.push('Max Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.maxVoltageValue.toFixed(3));
    }

    if (this.stringTableData.minVoltageValue !== null && this.stringTableData.minVoltageValue !== undefined) {
      stringMetricsHeaders.push('Min Vol Val(V)');
      stringMetricsValues.push(this.stringTableData.minVoltageValue.toFixed(3));
    }

    if (this.stringTableData.maxRstValue !== null && this.stringTableData.maxRstValue !== undefined) {
      stringMetricsHeaders.push('Max Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.maxRstValue.toFixed(3));
    }

    if (this.stringTableData.minRstValue !== null && this.stringTableData.minRstValue !== undefined) {
      stringMetricsHeaders.push('Min Rst Val(Ohm)');
      stringMetricsValues.push(this.stringTableData.minRstValue.toFixed(3));
    }

    if (this.stringTableData.maxTempValue !== null && this.stringTableData.maxTempValue !== undefined) {
      stringMetricsHeaders.push('Max Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.maxTempValue.toFixed(1));
    }

    if (this.stringTableData.minTempValue !== null && this.stringTableData.minTempValue !== undefined) {
      stringMetricsHeaders.push('Min Temp Val(°C)');
      stringMetricsValues.push(this.stringTableData.minTempValue.toFixed(1));
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('String Summary', margin, yPos);
    yPos += 8;

    if (stringMetricsHeaders.length > 0) {
      const midPoint = Math.ceil(stringMetricsHeaders.length / 2);

      if (stringMetricsHeaders.length > 10) {
        const firstRowHeaders = stringMetricsHeaders.slice(0, midPoint);
        const firstRowValues = stringMetricsValues.slice(0, midPoint);
        const secondRowHeaders = stringMetricsHeaders.slice(midPoint);
        const secondRowValues = stringMetricsValues.slice(midPoint);

        autoTable(doc, {
          head: [firstRowHeaders],
          body: [firstRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });

        yPos = (doc as any).lastAutoTable.finalY + 8;

        autoTable(doc, {
          head: [secondRowHeaders],
          body: [secondRowValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      } else {
        autoTable(doc, {
          head: [stringMetricsHeaders],
          body: [stringMetricsValues],
          startY: yPos,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [1, 37, 150],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 4
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: {left: margin, right: margin},
          theme: 'grid'
        });
      }

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(1, 37, 150);
    doc.text('Cell Data (Temperature & IR)', margin, yPos);
    yPos += 8;

    const totalCells = this.cellDataSource.length;
    if (totalCells === 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('No cell data available', margin, yPos);
      const totalPages = doc.internal.pages.length - 1;
      addFooter(1, totalPages);
      doc.autoPrint();
      window.open(URL.createObjectURL(doc.output('blob')), '_blank');
      return;
    }

    const cellsPerRow = 2;
    const totalRows = Math.ceil(totalCells / cellsPerRow);

    const tableData: any[] = [];
    for (let i = 0; i < totalRows; i++) {
      const row: any[] = [];
      for (let j = 0; j < cellsPerRow; j++) {
        const cellIndex = i * cellsPerRow + j;
        if (cellIndex < totalCells) {
          const cell = this.cellDataSource[cellIndex];
          row.push(
            cell.ID.toString(),
            cell.Temp !== null ? cell.Temp.toFixed(1) : 'N/A',
            cell.IR !== null ? cell.IR.toFixed(3) : 'N/A'
          );
        } else {
          row.push('', '', '');
        }
      }
      tableData.push(row);
    }

    const tableHeaders = ['ID', 'Temp(°C)', 'IR(U)', 'ID', 'Temp(°C)', 'IR(U)'];

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: yPos,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [1, 37, 150],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      columnStyles: {
        0: {halign: 'center'},
        1: {halign: 'right'},
        2: {halign: 'right'},
        3: {halign: 'center'},
        4: {halign: 'right'},
        5: {halign: 'right'}
      },
      margin: {left: margin, right: margin},
      theme: 'grid',
      didDrawPage: (data: any) => {
        const pageNum = doc.internal.pages.length - 1;
        const totalPages = pageNum;
        addFooter(pageNum, totalPages);
      }
    });

    const totalPages = doc.internal.pages.length - 1;
    addFooter(totalPages, totalPages);

    doc.autoPrint();
    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  }

  goBack() {
    // Check if there's a 'from' query parameter to know where to go back
    const fromParam = this.route.snapshot.queryParamMap.get('from');

    if (fromParam === 'dashboard') {
      // Navigate back to dashboard
      void this.router.navigate(['/']);
    } else {
      // Try to go back in browser history, fallback to string list
      if (window.history.length > 1) {
        this.location.back();
      } else {
        // Fallback to string list if no history
    void this.router.navigate(['/setting/strings']);
      }
    }
  }

  onTabChange(event: MatTabChangeEvent) {
    this.activeTabIndex = event.index;
  }

  // ========== Schedule Management ==========

  loadSchedules(): void {
    if (!this.baseStringName) return;

    this.scheduleService.getSchedulesObservable(this.baseStringName, this.scheduleLegacyStringIds).pipe(
      takeUntil(this.destroy$)
    ).subscribe(schedules => {
      this.schedules = schedules;
      this.updateActiveSchedule();
    });
  }

  startScheduleCheck(): void {
    // Backend refreshes values every 8 seconds, keep polling in sync
    this.scheduleCheckInterval = setInterval(() => {
      this.checkAndUpdateSchedules();
    }, 8000);
  }

  checkAndUpdateSchedules(): void {
    this.refreshSchedulesSnapshot();
  }

  updateActiveSchedule(): void {
    const now = Date.now();
    this.activeSchedule = this.schedules.find(
      s => s.status === 'running' && now >= s.startTime
    ) || null;
  }

  openScheduleDialog(schedule?: Schedule): void {
    const dialogRef = this.dialog.open(ScheduleFormComponent, {
      width: '600px',
      data: {schedule}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (schedule) {
          this.editSchedule(schedule.id, result);
        } else {
          this.createSchedule(result);
        }
      }
    });
  }

  createSchedule(formData: ScheduleFormData): void {
    if (!this.baseStringName) return;

    this.scheduleService.createSchedule(this.baseStringName, formData).pipe(
      takeUntil(this.destroy$)
    ).subscribe(
      schedule => {
        this.snackBar.open('Schedule created successfully', 'Close', {duration: 3000});
        this.refreshSchedulesSnapshot();
      },
      error => {
        console.error('Error creating schedule:', error);
        this.snackBar.open('Failed to create schedule', 'Close', {duration: 3000});
      }
    );
  }

  editSchedule(scheduleId: string, formData: ScheduleFormData): void {
    if (!this.baseStringName) return;

    this.scheduleService.updateSchedule(this.baseStringName, scheduleId, formData).pipe(
      takeUntil(this.destroy$)
    ).subscribe(
      schedule => {
        this.snackBar.open('Schedule updated successfully', 'Close', {duration: 3000});
        this.refreshSchedulesSnapshot();
      },
      error => {
        console.error('Error updating schedule:', error);
        this.snackBar.open('Failed to update schedule', 'Close', {duration: 3000});
      }
    );
  }

  deleteSchedule(schedule: Schedule): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete schedule',
        message: this.getDeleteMessage(schedule),
        type: 'danger'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed && this.baseStringName) {
        this.scheduleService.deleteSchedule(this.baseStringName, schedule.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(
          () => {
            this.snackBar.open('Schedule deleted', 'Close', {duration: 3000});
            this.refreshSchedulesSnapshot();
          },
          error => {
            console.error('Error deleting schedule:', error);
            this.snackBar.open('Failed to delete schedule', 'Close', {duration: 3000});
          }
        );
      }
    });
  }

  stopSchedule(schedule: Schedule): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Stop schedule',
        message: `Do you want to stop this schedule now?`,
        type: 'warning'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed && this.baseStringName) {
        this.scheduleService.stopSchedule(this.baseStringName, schedule.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(
          () => {
            this.snackBar.open('Schedule stopped', 'Close', {duration: 3000});
            this.refreshSchedulesSnapshot();
          },
          error => {
            console.error('Error stopping schedule:', error);
            this.snackBar.open('Failed to stop schedule', 'Close', {duration: 3000});
          }
        );
      }
    });
  }

  formatScheduleStatus(status: ScheduleStatus): string {
    const statusMap: Record<ScheduleStatus, string> = {
      'pending': 'Pending',
      'running': 'Running',
      'finished': 'Finished',
      'stopped': 'Stopped',
      'failed': 'Failed'
    };
    return statusMap[status] || status;
  }

  formatDateTime(timestamp?: number | null): string {
    if (!timestamp) {
      return '—';
    }
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private getDeleteMessage(schedule: Schedule): string {
    const start = this.formatDateTime(schedule.startTime);
    const end = schedule.endTime ? this.formatDateTime(schedule.endTime) : 'no recorded end time';
    return schedule.endTime
      ? `Are you sure you want to delete the schedule from ${start} to ${end}?`
      : `Are you sure you want to delete the schedule starting at ${start}?`;
  }

  canEditSchedule(schedule: Schedule): boolean {
    return schedule.status === 'pending';
  }

  canDeleteSchedule(schedule: Schedule): boolean {
    return schedule.status === 'pending';
  }

  canStopSchedule(schedule: Schedule): boolean {
    return schedule.status === 'running';
  }

  private refreshSchedulesSnapshot(): void {
    if (!this.baseStringName) return;
    this.scheduleService.getSchedules(this.baseStringName, this.scheduleLegacyStringIds).pipe(
      take(1),
      takeUntil(this.destroy$)
    ).subscribe((list) => {
      this.schedules = list;
      this.updateActiveSchedule();
    });
  }
}
