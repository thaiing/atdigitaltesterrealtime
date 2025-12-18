import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { Subscription } from 'rxjs';

import { TemperatureService } from '../../services/temperature.service';
import { ThermalCameraService } from '../../services/thermal-camera.service';
import { SensorService } from '../../services/sensor.service';
import { AlertService } from '../../services/alert.service';
import { TemperatureReading, TemperatureTrendPoint } from '../../interfaces/temperature.interface';
import { ZoneTemperature } from '../../interfaces/thermal-camera.interface';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    BaseChartDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  // Summary cards
  summaryCounts = {
    normal: 0,
    warning: 0,
    critical: 0,
  };

  cameraCounts = {
    connected: 0,
    alert: 0,
    disconnected: 0,
  };

  sensorCounts = {
    connected: 0,
    alert: 0,
    disconnected: 0,
  };

  activeAlertsCount = 0;

  // Temperature readings table
  temperatureReadings: TemperatureReading[] = [];
  displayedColumns = ['deviceName', 'value', 'status', 'timestamp'];

  // Zone temperatures from cameras
  zoneTemperatures: ZoneTemperature[] = [];

  // Chart configuration
  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Temperature (°C)',
        fill: true,
        tension: 0.4,
        borderColor: '#1565C0',
        backgroundColor: 'rgba(21, 101, 192, 0.1)',
        pointBackgroundColor: '#1565C0',
        pointBorderColor: '#fff',
        pointRadius: 3,
      },
    ],
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time',
        },
        grid: {
          display: false,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Temperature (°C)',
        },
        min: 0,
        max: 60,
      },
    },
  };

  chartType: ChartType = 'line';

  isLoading = true;
  private subscriptions: Subscription[] = [];

  private temperatureService = inject(TemperatureService);
  private cameraService = inject(ThermalCameraService);
  private sensorService = inject(SensorService);
  private alertService = inject(AlertService);
  private router = inject(Router);

  ngOnInit(): void {
    this.loadData();
    this.loadTrendChart();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadData(): void {
    // Temperature summary counts
    const tempSub = this.temperatureService.getSummaryCounts().subscribe((counts) => {
      this.summaryCounts = counts;
    });
    this.subscriptions.push(tempSub);

    // Camera counts
    const cameraSub = this.cameraService.getSummaryCounts().subscribe((counts) => {
      this.cameraCounts = counts;
    });
    this.subscriptions.push(cameraSub);

    // Sensor counts
    const sensorSub = this.sensorService.getSummaryCounts().subscribe((counts) => {
      this.sensorCounts = counts;
    });
    this.subscriptions.push(sensorSub);

    // Active alerts count
    const alertSub = this.alertService.getActiveAlertsCount().subscribe((count) => {
      this.activeAlertsCount = count;
    });
    this.subscriptions.push(alertSub);

    // Temperature readings
    const readingsSub = this.temperatureService.getAllReadings().subscribe((readings) => {
      this.temperatureReadings = readings;
      this.isLoading = false;
    });
    this.subscriptions.push(readingsSub);

    // Zone temperatures
    const zoneSub = this.cameraService.getAllZoneTemperatures().subscribe((zones) => {
      this.zoneTemperatures = zones;
    });
    this.subscriptions.push(zoneSub);
  }

  private loadTrendChart(): void {
    // Load trend data for first device
    this.temperatureService.getTemperatureTrend('sensor-001', 12).subscribe((data) => {
      this.chartData.labels = data.map((p) =>
        new Date(p.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
      this.chartData.datasets[0].data = data.map((p) => p.value);
      this.chart?.update();
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'normal':
        return 'status-normal';
      case 'warning':
        return 'status-warning';
      case 'critical':
        return 'status-critical';
      default:
        return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'normal':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'help';
    }
  }

  navigateToAlerts(): void {
    this.router.navigate(['/alerts/active']);
  }

  navigateToEMap(): void {
    this.router.navigate(['/e-map']);
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}


