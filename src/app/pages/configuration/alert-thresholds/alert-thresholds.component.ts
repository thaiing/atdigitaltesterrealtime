import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AlertService } from '../../../services/alert.service';
import { AuthService } from '../../../services/auth.service';
import { AlertThreshold } from '../../../interfaces/alert.interface';

@Component({
  selector: 'app-alert-thresholds',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './alert-thresholds.component.html',
  styleUrl: './alert-thresholds.component.scss',
})
export class AlertThresholdsComponent implements OnInit {
  thresholds: AlertThreshold[] = [];
  displayedColumns = ['name', 'condition', 'severity', 'notifications', 'enabled', 'actions'];
  isLoading = true;

  private alertService = inject(AlertService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.alertService.getAllThresholds().subscribe((thresholds) => {
      this.thresholds = thresholds;
      this.isLoading = false;
    });
  }

  addThreshold(): void {
    this.authService.showMessage('Threshold form would open here', 'info');
  }

  editThreshold(threshold: AlertThreshold): void {
    this.authService.showMessage(`Editing: ${threshold.name}`, 'info');
  }

  deleteThreshold(threshold: AlertThreshold): void {
    if (confirm(`Delete threshold "${threshold.name}"?`)) {
      this.alertService.deleteThreshold(threshold.id).subscribe(() => {
        this.authService.showMessage('Threshold deleted', 'success');
      });
    }
  }

  toggleThreshold(threshold: AlertThreshold): void {
    this.alertService.toggleThreshold(threshold.id).subscribe();
  }

  getConditionText(threshold: AlertThreshold): string {
    const { condition } = threshold;
    switch (condition.type) {
      case 'above': return `> ${condition.value}°C`;
      case 'below': return `< ${condition.value}°C`;
      case 'range': return `${condition.minValue}°C - ${condition.maxValue}°C`;
      case 'change': return `±${condition.changeAmount}°C in ${(condition.changePeriod || 0) / 60}min`;
      default: return '-';
    }
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity}`;
  }
}


