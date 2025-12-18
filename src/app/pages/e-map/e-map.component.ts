import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription } from 'rxjs';

import { ThermalCameraService } from '../../services/thermal-camera.service';
import { SensorService } from '../../services/sensor.service';
import { ThermalCamera } from '../../interfaces/thermal-camera.interface';
import { TemperatureSensor } from '../../interfaces/sensor.interface';

interface MapDevice {
  id: string;
  name: string;
  type: 'camera' | 'sensor';
  status: 'connected' | 'alert' | 'disconnected';
  position: { x: number; y: number };
  temperature?: number;
}

@Component({
  selector: 'app-e-map',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatChipsModule,
  ],
  templateUrl: './e-map.component.html',
  styleUrl: './e-map.component.scss',
})
export class EMapComponent implements OnInit, OnDestroy {
  devices: MapDevice[] = [];
  selectedDevice: MapDevice | null = null;
  cameras: ThermalCamera[] = [];
  sensors: TemperatureSensor[] = [];

  // Map dimensions
  mapWidth = 800;
  mapHeight = 600;

  private subscriptions: Subscription[] = [];
  private cameraService = inject(ThermalCameraService);
  private sensorService = inject(SensorService);

  ngOnInit(): void {
    this.loadDevices();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadDevices(): void {
    // Load cameras
    const cameraSub = this.cameraService.getAllCameras().subscribe((cameras) => {
      this.cameras = cameras;
      this.updateDeviceList();
    });
    this.subscriptions.push(cameraSub);

    // Load sensors
    const sensorSub = this.sensorService.getAllSensors().subscribe((sensors) => {
      this.sensors = sensors;
      this.updateDeviceList();
    });
    this.subscriptions.push(sensorSub);
  }

  private updateDeviceList(): void {
    const cameraDevices: MapDevice[] = this.cameras
      .filter((c) => c.location)
      .map((camera) => ({
        id: camera.id,
        name: camera.name,
        type: 'camera' as const,
        status: camera.status,
        position: camera.location!,
        temperature: camera.zones[0]?.currentTemperature?.avgTemp,
      }));

    const sensorDevices: MapDevice[] = this.sensors
      .filter((s) => s.position)
      .map((sensor) => ({
        id: sensor.id,
        name: sensor.name,
        type: 'sensor' as const,
        status: sensor.status,
        position: sensor.position!,
        temperature: sensor.currentValue,
      }));

    this.devices = [...cameraDevices, ...sensorDevices];
  }

  selectDevice(device: MapDevice): void {
    this.selectedDevice = this.selectedDevice?.id === device.id ? null : device;
  }

  getDeviceIcon(type: string): string {
    return type === 'camera' ? 'videocam' : 'thermostat';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'connected':
        return 'status-connected';
      case 'alert':
        return 'status-alert';
      case 'disconnected':
        return 'status-disconnected';
      default:
        return '';
    }
  }

  getDevicePosition(device: MapDevice): { left: string; top: string } {
    const left = (device.position.x / this.mapWidth) * 100;
    const top = (device.position.y / this.mapHeight) * 100;
    return {
      left: `${left}%`,
      top: `${top}%`,
    };
  }
}


