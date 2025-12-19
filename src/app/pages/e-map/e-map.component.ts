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
  rotation?: number; // Rotation in degrees
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

  // Map dimensions (schematic image ratio)
  // The original image seems to be landscape. 
  // We'll use percentage-based positioning, so absolute dimensions matter less 
  // but help with initial aspect ratio if needed.
  mapWidth = 1000;
  mapHeight = 700;

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
    // Defines manual positions to match the "uploaded_image_3" reference
    // Since we don't have real coordinates from backend matching this specific image yet.
    const demoConfig: { [key: string]: { x: number; y: number; rotation: number } } = {
      'cam-01': { x: 28, y: 30, rotation: 10 },    // T1 Transformer (Left)
      'cam-02': { x: 28, y: 65, rotation: -10 },   // T2 Transformer (Left)
      'cam-03': { x: 92, y: 20, rotation: 170 },   // Top Right
      'cam-04': { x: 92, y: 80, rotation: 190 },   // Bottom Right
      'cam-05': { x: 65, y: 45, rotation: 180 },   // Center Right
      'cam-06': { x: 65, y: 55, rotation: 180 },   // Center Right
    };

    const cameraDevices: MapDevice[] = this.cameras
      .map((camera, index) => {
        // Fallback or override positions for demo purposes to match the schematic
        // We simulate ID matching if real IDs aren't established, or just map by index
        const configKey = Object.keys(demoConfig)[index % Object.keys(demoConfig).length];
        const config = demoConfig[configKey];

        return {
          id: camera.id,
          name: camera.name,
          type: 'camera' as const,
          status: camera.status,
          position: config ? { x: config.x, y: config.y } : (camera.location || { x: 50, y: 50 }),
          rotation: config ? config.rotation : 0,
          temperature: camera.zones[0]?.currentTemperature?.avgTemp,
        };
      });

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
    // Positions are now stored as percentages (0-100) in the demo config
    return {
      left: `${device.position.x}%`,
      top: `${device.position.y}%`,
    };
  }
}


