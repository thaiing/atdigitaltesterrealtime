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

import { AlertService } from '../../../services/alert.service';
import { AuthService } from '../../../services/auth.service';
import { Alert } from '../../../interfaces/alert.interface';

@Component({
  selector: 'app-alert-list',
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
  templateUrl: './alert-list.component.html',
  styleUrl: './alert-list.component.scss',
})
export class AlertListComponent implements OnInit, OnDestroy {
  alerts: Alert[] = [];
  displayedColumns = ['severity', 'title', 'deviceName', 'value', 'timestamp', 'actions'];
  isLoading = true;
  criticalCount = 0;
  warningCount = 0;

  private subscriptions: Subscription[] = [];
  private alertService = inject(AlertService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.loadAlerts();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadAlerts(): void {
    const sub = this.alertService.getActiveAlerts().subscribe((alerts) => {
      this.alerts = alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
      this.criticalCount = this.alerts.filter(a => a.severity === 'critical').length;
      this.warningCount = this.alerts.filter(a => a.severity === 'warning').length;
      this.isLoading = false;
    });
    this.subscriptions.push(sub);
  }

  acknowledgeAlert(alert: Alert): void {
    const user = this.authService.currentUser;
    if (!user) return;

    this.alertService.acknowledgeAlert(alert.id, user.username).subscribe((updated) => {
      if (updated) {
        this.authService.showMessage('Alert acknowledged', 'success');
      }
    });
  }

  resolveAlert(alert: Alert): void {
    this.alertService.resolveAlert(alert.id).subscribe((updated) => {
      if (updated) {
        this.authService.showMessage('Alert resolved', 'success');
      }
    });
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'help';
    }
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity}`;
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
}

