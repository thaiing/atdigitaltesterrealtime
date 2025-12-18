import { Component, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';

import { TemperatureService } from '../../services/temperature.service';
import { AuthService } from '../../services/auth.service';

interface ReportData {
  device: string;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  readings: number;
  warnings: number;
  criticals: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  // Filters
  reportType = 'temperature';
  dateRange = 'week';
  startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  endDate = new Date();

  // Data
  reportData: ReportData[] = [];
  displayedColumns = ['device', 'avgTemp', 'minTemp', 'maxTemp', 'readings', 'warnings', 'criticals'];
  isLoading = false;

  // Chart
  chartData: ChartConfiguration['data'] = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [35, 38, 42, 40, 39, 36, 35],
        label: 'Avg Temperature',
        borderColor: '#1565C0',
        backgroundColor: 'rgba(21, 101, 192, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        data: [28, 30, 32, 31, 30, 28, 27],
        label: 'Min Temperature',
        borderColor: '#43A047',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
      },
      {
        data: [45, 48, 52, 50, 48, 45, 44],
        label: 'Max Temperature',
        borderColor: '#E53935',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
      },
    ],
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      y: { beginAtZero: false, min: 20, max: 60 },
    },
  };

  chartType: ChartType = 'line';

  private temperatureService = inject(TemperatureService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.generateReport();
  }

  generateReport(): void {
    this.isLoading = true;

    // Simulate report generation
    setTimeout(() => {
      this.reportData = [
        { device: 'Transformer T1', avgTemp: 42.5, minTemp: 38.2, maxTemp: 48.7, readings: 672, warnings: 15, criticals: 2 },
        { device: 'Transformer T2', avgTemp: 38.8, minTemp: 35.1, maxTemp: 44.2, readings: 672, warnings: 8, criticals: 0 },
        { device: 'Busbar Section A', avgTemp: 35.2, minTemp: 30.5, maxTemp: 42.1, readings: 672, warnings: 3, criticals: 0 },
        { device: 'Circuit Breaker CB1', avgTemp: 28.5, minTemp: 24.2, maxTemp: 33.8, readings: 672, warnings: 0, criticals: 0 },
        { device: 'Cable Junction J1', avgTemp: 36.8, minTemp: 32.4, maxTemp: 41.5, readings: 672, warnings: 5, criticals: 0 },
      ];
      this.isLoading = false;
    }, 1000);
  }

  exportPDF(): void {
    this.authService.showMessage('PDF export would be implemented here', 'info');
  }

  exportExcel(): void {
    this.authService.showMessage('Excel export would be implemented here', 'info');
  }

  onDateRangeChange(): void {
    switch (this.dateRange) {
      case 'day':
        this.startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        this.startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        this.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        this.startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
    this.endDate = new Date();
  }
}


