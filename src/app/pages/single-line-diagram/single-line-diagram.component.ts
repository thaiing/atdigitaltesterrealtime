import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

interface DiagramDevice {
  id: string;
  name: string;
  type: 'transformer' | 'breaker' | 'busbar' | 'cable' | 'load';
  temperature?: number;
  status: 'normal' | 'warning' | 'critical';
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-single-line-diagram',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './single-line-diagram.component.html',
  styleUrl: './single-line-diagram.component.scss',
})
export class SingleLineDiagramComponent {
  devices: DiagramDevice[] = [
    { id: 't1', name: 'Transformer T1', type: 'transformer', temperature: 42.5, status: 'warning', x: 100, y: 100, width: 80, height: 100 },
    { id: 't2', name: 'Transformer T2', type: 'transformer', temperature: 38.2, status: 'normal', x: 300, y: 100, width: 80, height: 100 },
    { id: 'cb1', name: 'Circuit Breaker 1', type: 'breaker', temperature: 28.5, status: 'normal', x: 140, y: 220, width: 40, height: 40 },
    { id: 'cb2', name: 'Circuit Breaker 2', type: 'breaker', temperature: 31.2, status: 'normal', x: 340, y: 220, width: 40, height: 40 },
    { id: 'bb1', name: 'Main Busbar', type: 'busbar', temperature: 35.8, status: 'normal', x: 50, y: 280, width: 420, height: 20 },
    { id: 'l1', name: 'Load 1', type: 'load', status: 'normal', x: 120, y: 350, width: 60, height: 60 },
    { id: 'l2', name: 'Load 2', type: 'load', status: 'normal', x: 320, y: 350, width: 60, height: 60 },
  ];

  selectedDevice: DiagramDevice | null = null;

  selectDevice(device: DiagramDevice): void {
    this.selectedDevice = this.selectedDevice?.id === device.id ? null : device;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getDeviceStyle(device: DiagramDevice): { [key: string]: string } {
    return {
      left: `${device.x}px`,
      top: `${device.y}px`,
      width: `${device.width}px`,
      height: `${device.height}px`,
    };
  }
}


