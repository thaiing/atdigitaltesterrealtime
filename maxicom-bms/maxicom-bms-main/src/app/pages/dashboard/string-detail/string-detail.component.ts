import {Component, OnInit, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Location} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatChipsModule} from '@angular/material/chips'; // <-- 1. Dòng này ĐÚNG
import {Subscription} from 'rxjs';
import {DashboardService} from '../../../services/dashboard.service';
import {
  StringDetailData,
  CellData,
} from '../../../interfaces/dashboard.interface';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

@Component({
  selector: 'app-string-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule, // <-- 2. Dòng này ĐÚNG
    MatProgressSpinnerModule,
  ],
  templateUrl: './string-detail.component.html',
  styleUrl: './string-detail.component.scss',
})
export class StringDetailComponent implements OnInit, OnDestroy {
  stringDetail?: StringDetailData;
  stringId?: string;
  stringName?: string;
  isLoading = true;

  private subscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private dashboardService: DashboardService
  ) {
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      // Sửa lại param name cho đúng (theo app.routes.ts)
      this.stringId = params.get('stringId') || '';
      this.stringName = this.route.snapshot.queryParams['name'] || '';
      this.loadStringDetail();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadStringDetail() {
    if (this.stringId) {
      this.isLoading = true;
      this.subscription = this.dashboardService
        .getStringDetailData(this.stringId)
        .subscribe(
          (data) => {
            this.stringDetail = data;
            this.isLoading = false;
          },
          (error) => {
            console.error('Error loading string detail:', error);
            this.isLoading = false;
          }
        );
    }
  }

  goBack() {
    // Luôn quay về Dashboard
    void this.router.navigate(['/dashboard']);
  }


  refreshData() {
    this.loadStringDetail();
  }

  getCellStatusClass(cell: CellData): string {
    switch (cell.status) {
      case 'warning':
        return 'cell-warning';
      case 'error':
        return 'cell-error';
      default:
        return 'cell-normal';
    }
  }

  getCellTooltip(cell: CellData): string {
    return `Cell ${cell.cellNumber}\nVoltage: ${cell.voltage.toFixed(3)}V\nTemperature: ${cell.temperature.toFixed(1)}°C\nResistance: ${cell.resistance.toFixed(2)}mΩ`;
  }

  getVoltagePercentage(voltage: number): number {
    const minVoltage = 2.8;
    const maxVoltage = 3.6;
    return ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100;
  }

  getTemperatureClass(temperature: number): string {
    if (temperature > 35) return 'temp-high';
    if (temperature < 15) return 'temp-low';
    return 'temp-normal';
  }

  exportData(type: 'voltage' | 'temperature') {
    // This would implement the PDF export functionality
    console.log(`Exporting ${type} data...`);
    // Implementation for PDF generation would go here
  }

  printData(type: 'voltage' | 'temperature') {
    // This would implement the print functionality
    console.log(`Printing ${type} data...`);
    // Implementation for printing would go here
  }
}

// DẤU '}' THỪA Ở ĐÂY ĐÃ ĐƯỢC XÓA
