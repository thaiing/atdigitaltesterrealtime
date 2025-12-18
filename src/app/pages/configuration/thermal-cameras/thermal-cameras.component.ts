import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { ThermalCameraService } from '../../../services/thermal-camera.service';
import { AuthService } from '../../../services/auth.service';
import { ThermalCamera } from '../../../interfaces/thermal-camera.interface';

@Component({
  selector: 'app-thermal-cameras',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './thermal-cameras.component.html',
  styleUrl: './thermal-cameras.component.scss',
})
export class ThermalCamerasComponent implements OnInit, OnDestroy {
  cameras: ThermalCamera[] = [];
  displayedColumns = ['name', 'type', 'brand', 'ipAddress', 'zones', 'status', 'actions'];
  isLoading = true;

  private subscriptions: Subscription[] = [];
  private cameraService = inject(ThermalCameraService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.loadCameras();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadCameras(): void {
    const sub = this.cameraService.getAllCameras().subscribe((cameras) => {
      this.cameras = cameras;
      this.isLoading = false;
    });
    this.subscriptions.push(sub);
  }

  addCamera(): void {
    this.authService.showMessage('Camera form dialog would open here', 'info');
  }

  editCamera(camera: ThermalCamera): void {
    this.authService.showMessage(`Editing camera: ${camera.name}`, 'info');
  }

  deleteCamera(camera: ThermalCamera): void {
    if (confirm(`Delete camera "${camera.name}"?`)) {
      this.cameraService.deleteCamera(camera.id).subscribe(() => {
        this.authService.showMessage('Camera deleted', 'success');
      });
    }
  }

  runCalibration(camera: ThermalCamera): void {
    this.authService.showMessage(`Running calibration for ${camera.name}...`, 'info');
    this.cameraService.runCalibration(camera.id).subscribe((result) => {
      if (result.success) {
        this.authService.showMessage('Calibration completed successfully', 'success');
      } else {
        this.authService.showMessage('Calibration failed', 'error');
      }
    });
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }
}


