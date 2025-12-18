import { Injectable } from '@angular/core';
import { Observable, of, delay, interval, map, startWith, BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  TemperatureReading,
  TemperatureTrendPoint,
  TemperatureStats,
  TemperatureDifference,
  ManualMeasurement,
} from '../interfaces/temperature.interface';

// Mock data generators
const generateMockTemperature = (): number => {
  return 25 + Math.random() * 20; // 25-45°C
};

const getStatus = (temp: number): 'normal' | 'warning' | 'critical' => {
  if (temp > 40) return 'critical';
  if (temp > 35) return 'warning';
  return 'normal';
};

// Mock temperature readings
const MOCK_READINGS: TemperatureReading[] = [
  {
    id: '1',
    deviceId: 'sensor-001',
    deviceName: 'Transformer T1',
    deviceType: 'sensor',
    value: 38.5,
    unit: 'C',
    timestamp: new Date(),
    status: 'warning',
  },
  {
    id: '2',
    deviceId: 'sensor-002',
    deviceName: 'Transformer T2',
    deviceType: 'sensor',
    value: 32.1,
    unit: 'C',
    timestamp: new Date(),
    status: 'normal',
  },
  {
    id: '3',
    deviceId: 'camera-001-zone-1',
    deviceName: 'Busbar Section A',
    deviceType: 'camera_zone',
    value: 45.2,
    unit: 'C',
    timestamp: new Date(),
    status: 'critical',
  },
  {
    id: '4',
    deviceId: 'sensor-003',
    deviceName: 'Circuit Breaker CB1',
    deviceType: 'sensor',
    value: 28.7,
    unit: 'C',
    timestamp: new Date(),
    status: 'normal',
  },
  {
    id: '5',
    deviceId: 'camera-001-zone-2',
    deviceName: 'Cable Junction J1',
    deviceType: 'camera_zone',
    value: 36.8,
    unit: 'C',
    timestamp: new Date(),
    status: 'warning',
  },
];

@Injectable({
  providedIn: 'root',
})
export class TemperatureService {
  private readingsSubject = new BehaviorSubject<TemperatureReading[]>(MOCK_READINGS);
  public readings$ = this.readingsSubject.asObservable();

  constructor(private http: HttpClient) {
    // Simulate real-time updates every 5 seconds
    this.startRealTimeUpdates();
  }

  private startRealTimeUpdates(): void {
    interval(5000).subscribe(() => {
      const updatedReadings = this.readingsSubject.value.map(reading => ({
        ...reading,
        value: reading.value + (Math.random() - 0.5) * 2, // ±1°C variation
        timestamp: new Date(),
        status: getStatus(reading.value),
      }));
      this.readingsSubject.next(updatedReadings);
    });
  }

  /**
   * Get all temperature readings
   */
  getAllReadings(): Observable<TemperatureReading[]> {
    return this.readings$;
  }

  /**
   * Get temperature reading by device ID
   */
  getReadingByDevice(deviceId: string): Observable<TemperatureReading | undefined> {
    return this.readings$.pipe(
      map(readings => readings.find(r => r.deviceId === deviceId))
    );
  }

  /**
   * Get temperature statistics for all devices
   */
  getTemperatureStats(): Observable<TemperatureStats[]> {
    return this.readings$.pipe(
      map(readings => readings.map(reading => ({
        deviceId: reading.deviceId,
        deviceName: reading.deviceName,
        currentValue: reading.value,
        minValue: reading.value - 5,
        maxValue: reading.value + 5,
        avgValue: reading.value,
        status: reading.status,
        lastUpdated: reading.timestamp,
      })))
    );
  }

  /**
   * Get temperature trend data for a device
   */
  getTemperatureTrend(deviceId: string, hours: number = 24): Observable<TemperatureTrendPoint[]> {
    // Generate mock trend data
    const now = new Date();
    const points: TemperatureTrendPoint[] = [];
    const baseTemp = 30 + Math.random() * 10;
    
    for (let i = hours * 2; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 30 * 60 * 1000); // 30 min intervals
      const variation = Math.sin(i / 4) * 5 + (Math.random() - 0.5) * 2;
      const value = baseTemp + variation;
      
      points.push({
        timestamp,
        value,
        min: value - Math.random() * 2,
        max: value + Math.random() * 2,
        avg: value,
      });
    }
    
    return of(points).pipe(delay(300));
  }

  /**
   * Calculate temperature difference between two points (CBM)
   */
  calculateTemperatureDifference(
    deviceIdA: string,
    deviceIdB: string
  ): Observable<TemperatureDifference | null> {
    return this.readings$.pipe(
      map(readings => {
        const pointA = readings.find(r => r.deviceId === deviceIdA);
        const pointB = readings.find(r => r.deviceId === deviceIdB);
        
        if (!pointA || !pointB) return null;
        
        const difference = Math.abs(pointA.value - pointB.value);
        
        return {
          id: `cbm-${deviceIdA}-${deviceIdB}`,
          pointA: {
            deviceId: pointA.deviceId,
            deviceName: pointA.deviceName,
            value: pointA.value,
          },
          pointB: {
            deviceId: pointB.deviceId,
            deviceName: pointB.deviceName,
            value: pointB.value,
          },
          difference,
          timestamp: new Date(),
          status: difference > 10 ? 'critical' : difference > 5 ? 'warning' : 'normal',
        };
      })
    );
  }

  /**
   * Add manual measurement
   */
  addManualMeasurement(measurement: Omit<ManualMeasurement, 'id' | 'timestamp'>): Observable<ManualMeasurement> {
    const newMeasurement: ManualMeasurement = {
      ...measurement,
      id: `manual-${Date.now()}`,
      timestamp: new Date(),
    };
    
    return of(newMeasurement).pipe(delay(300));
  }

  /**
   * Get summary counts for dashboard
   */
  getSummaryCounts(): Observable<{ normal: number; warning: number; critical: number }> {
    return this.readings$.pipe(
      map(readings => ({
        normal: readings.filter(r => r.status === 'normal').length,
        warning: readings.filter(r => r.status === 'warning').length,
        critical: readings.filter(r => r.status === 'critical').length,
      }))
    );
  }
}


