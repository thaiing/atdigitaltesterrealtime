import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'app-network',
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
    MatSlideToggleModule,
    MatTabsModule,
  ],
  templateUrl: './network.component.html',
  styleUrl: './network.component.scss',
})
export class NetworkComponent {
  networkConfig = {
    eth0: {
      isDhcp: true,
      ipAddress: '',
      subnetMask: '255.255.255.0',
      gateway: '',
      dns: '8.8.8.8',
    },
    eth1: {
      isDhcp: false,
      ipAddress: '192.168.1.100',
      subnetMask: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: '8.8.8.8',
    },
  };

  modbusConfig = {
    enabled: true,
    port: 502,
    slaveId: 1,
  };

  iec104Config = {
    enabled: false,
    port: 2404,
    commonAddress: 1,
  };

  saveNetworkConfig(): void {
    alert('Network configuration saved');
  }

  saveModbusConfig(): void {
    alert('Modbus configuration saved');
  }

  saveIec104Config(): void {
    alert('IEC 104 configuration saved');
  }
}


