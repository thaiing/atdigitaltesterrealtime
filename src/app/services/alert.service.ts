import { Injectable } from '@angular/core';
import { Observable, of, delay, BehaviorSubject, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  Alert,
  AlertThreshold,
  AlertStats,
  AlertNotificationSettings,
} from '../interfaces/alert.interface';

// Mock alerts
const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-001',
    type: 'temperature',
    severity: 'critical',
    status: 'active',
    deviceId: 'camera-001-zone-1',
    deviceName: 'Busbar Section A',
    deviceType: 'camera',
    title: 'Critical Temperature Exceeded',
    message: 'Temperature has exceeded critical threshold of 50°C. Current: 52.3°C',
    value: 52.3,
    threshold: 50,
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  },
  {
    id: 'alert-002',
    type: 'temperature',
    severity: 'warning',
    status: 'active',
    deviceId: 'sensor-001',
    deviceName: 'Transformer T1',
    deviceType: 'sensor',
    title: 'High Temperature Warning',
    message: 'Temperature approaching warning threshold. Current: 42.1°C',
    value: 42.1,
    threshold: 45,
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
  },
  {
    id: 'alert-003',
    type: 'device',
    severity: 'warning',
    status: 'acknowledged',
    deviceId: 'camera-003',
    deviceName: 'Thermal Camera 3 - Outdoor',
    deviceType: 'camera',
    title: 'Camera Connection Unstable',
    message: 'Camera experiencing intermittent connection issues',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    acknowledgedBy: 'admin',
    acknowledgedAt: new Date(Date.now() - 20 * 60 * 1000),
  },
  {
    id: 'alert-004',
    type: 'calibration',
    severity: 'info',
    status: 'resolved',
    deviceId: 'camera-002',
    deviceName: 'Thermal Camera 2 - Control Room',
    deviceType: 'camera',
    title: 'Calibration Required',
    message: 'Camera calibration scheduled for maintenance',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
];

// Mock thresholds
const MOCK_THRESHOLDS: AlertThreshold[] = [
  {
    id: 'threshold-001',
    name: 'High Temperature Warning',
    description: 'Trigger warning when temperature exceeds 40°C',
    deviceType: 'all',
    condition: { type: 'above', value: 40 },
    severity: 'warning',
    enabled: true,
    notifyEmail: true,
    notifySound: true,
  },
  {
    id: 'threshold-002',
    name: 'Critical Temperature Alert',
    description: 'Trigger critical alert when temperature exceeds 50°C',
    deviceType: 'all',
    condition: { type: 'above', value: 50 },
    severity: 'critical',
    enabled: true,
    notifyEmail: true,
    notifySms: true,
    notifySound: true,
  },
  {
    id: 'threshold-003',
    name: 'Rapid Temperature Rise',
    description: 'Alert on temperature rising more than 5°C in 5 minutes',
    deviceType: 'sensor',
    condition: { type: 'change', changeAmount: 5, changePeriod: 300 },
    severity: 'warning',
    enabled: true,
    notifySound: true,
  },
];

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private alertsSubject = new BehaviorSubject<Alert[]>(MOCK_ALERTS);
  private thresholdsSubject = new BehaviorSubject<AlertThreshold[]>(MOCK_THRESHOLDS);

  public alerts$ = this.alertsSubject.asObservable();
  public thresholds$ = this.thresholdsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get all alerts
   */
  getAllAlerts(): Observable<Alert[]> {
    return this.alerts$;
  }

  /**
   * Get active alerts only
   */
  getActiveAlerts(): Observable<Alert[]> {
    return this.alerts$.pipe(
      map(alerts => alerts.filter(a => a.status === 'active'))
    );
  }

  /**
   * Get alert history (acknowledged and resolved)
   */
  getAlertHistory(): Observable<Alert[]> {
    return this.alerts$.pipe(
      map(alerts => alerts.filter(a => a.status !== 'active'))
    );
  }

  /**
   * Get alert by ID
   */
  getAlertById(id: string): Observable<Alert | undefined> {
    return this.alerts$.pipe(
      map(alerts => alerts.find(a => a.id === id))
    );
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(id: string, acknowledgedBy: string, notes?: string): Observable<Alert | null> {
    const alerts = this.alertsSubject.value;
    const index = alerts.findIndex(a => a.id === id);
    
    if (index === -1) return of(null);
    
    const updatedAlert: Alert = {
      ...alerts[index],
      status: 'acknowledged',
      acknowledgedBy,
      acknowledgedAt: new Date(),
      notes,
    };
    
    alerts[index] = updatedAlert;
    this.alertsSubject.next([...alerts]);
    
    return of(updatedAlert).pipe(delay(300));
  }

  /**
   * Resolve alert
   */
  resolveAlert(id: string, notes?: string): Observable<Alert | null> {
    const alerts = this.alertsSubject.value;
    const index = alerts.findIndex(a => a.id === id);
    
    if (index === -1) return of(null);
    
    const updatedAlert: Alert = {
      ...alerts[index],
      status: 'resolved',
      resolvedAt: new Date(),
      notes: notes || alerts[index].notes,
    };
    
    alerts[index] = updatedAlert;
    this.alertsSubject.next([...alerts]);
    
    return of(updatedAlert).pipe(delay(300));
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): Observable<AlertStats> {
    return this.alerts$.pipe(
      map(alerts => ({
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
        bySeverity: {
          info: alerts.filter(a => a.severity === 'info').length,
          warning: alerts.filter(a => a.severity === 'warning').length,
          critical: alerts.filter(a => a.severity === 'critical').length,
        },
        byType: {
          temperature: alerts.filter(a => a.type === 'temperature').length,
          device: alerts.filter(a => a.type === 'device').length,
          system: alerts.filter(a => a.type === 'system').length,
          calibration: alerts.filter(a => a.type === 'calibration').length,
        },
      }))
    );
  }

  /**
   * Get active alerts count
   */
  getActiveAlertsCount(): Observable<number> {
    return this.getActiveAlerts().pipe(map(alerts => alerts.length));
  }

  // ============ Threshold Management ============

  /**
   * Get all thresholds
   */
  getAllThresholds(): Observable<AlertThreshold[]> {
    return this.thresholds$;
  }

  /**
   * Add threshold
   */
  addThreshold(threshold: Omit<AlertThreshold, 'id'>): Observable<AlertThreshold> {
    const newThreshold: AlertThreshold = {
      ...threshold,
      id: `threshold-${Date.now()}`,
    };
    
    const thresholds = [...this.thresholdsSubject.value, newThreshold];
    this.thresholdsSubject.next(thresholds);
    
    return of(newThreshold).pipe(delay(300));
  }

  /**
   * Update threshold
   */
  updateThreshold(id: string, updates: Partial<AlertThreshold>): Observable<AlertThreshold | null> {
    const thresholds = this.thresholdsSubject.value;
    const index = thresholds.findIndex(t => t.id === id);
    
    if (index === -1) return of(null);
    
    const updatedThreshold = { ...thresholds[index], ...updates };
    thresholds[index] = updatedThreshold;
    this.thresholdsSubject.next([...thresholds]);
    
    return of(updatedThreshold).pipe(delay(300));
  }

  /**
   * Delete threshold
   */
  deleteThreshold(id: string): Observable<boolean> {
    const thresholds = this.thresholdsSubject.value.filter(t => t.id !== id);
    this.thresholdsSubject.next(thresholds);
    return of(true).pipe(delay(300));
  }

  /**
   * Toggle threshold enabled state
   */
  toggleThreshold(id: string): Observable<AlertThreshold | null> {
    const thresholds = this.thresholdsSubject.value;
    const threshold = thresholds.find(t => t.id === id);
    
    if (!threshold) return of(null);
    
    return this.updateThreshold(id, { enabled: !threshold.enabled });
  }
}


