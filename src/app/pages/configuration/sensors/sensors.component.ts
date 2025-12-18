import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { SensorService } from '../../../services/sensor.service';
import { AuthService } from '../../../services/auth.service';
import { TemperatureSensor } from '../../../interfaces/sensor.interface';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './sensors.component.html',
  styleUrl: './sensors.component.scss',
})
export class SensorsComponent implements OnInit, OnDestroy {
  sensors: TemperatureSensor[] = [];
  displayedColumns = ['name', 'type', 'location', 'communication', 'currentValue', 'status', 'actions'];
  isLoading = true;

  private subscriptions: Subscription[] = [];
  private sensorService = inject(SensorService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.loadSensors();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadSensors(): void {
    const sub = this.sensorService.getAllSensors().subscribe((sensors) => {
      this.sensors = sensors;
      this.isLoading = false;
    });
    this.subscriptions.push(sub);
  }

  addSensor(): void {
    this.authService.showMessage('Sensor form dialog would open here', 'info');
  }

  editSensor(sensor: TemperatureSensor): void {
    this.authService.showMessage(`Editing sensor: ${sensor.name}`, 'info');
  }

  deleteSensor(sensor: TemperatureSensor): void {
    if (confirm(`Delete sensor "${sensor.name}"?`)) {
      this.sensorService.deleteSensor(sensor.id).subscribe(() => {
        this.authService.showMessage('Sensor deleted', 'success');
      });
    }
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getCommunicationType(sensor: TemperatureSensor): string {
    return sensor.communication.type.replace('_', ' ');
  }
}


