import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { AlertService } from '../../../services/alert.service';
import { Alert } from '../../../interfaces/alert.interface';

@Component({
  selector: 'app-alert-history',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './alert-history.component.html',
  styleUrl: './alert-history.component.scss',
})
export class AlertHistoryComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<Alert>([]);
  displayedColumns = ['severity', 'title', 'deviceName', 'status', 'timestamp', 'resolvedAt'];
  isLoading = true;

  // Filters
  filterSeverity = '';
  filterType = '';
  searchText = '';

  private subscriptions: Subscription[] = [];
  private alertService = inject(AlertService);

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadHistory(): void {
    const sub = this.alertService.getAlertHistory().subscribe((alerts) => {
      this.dataSource.data = alerts;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.isLoading = false;
    });
    this.subscriptions.push(sub);
  }

  applyFilter(): void {
    this.dataSource.filter = this.searchText.trim().toLowerCase();
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'help';
    }
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity}`;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  formatTime(date: Date | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}


