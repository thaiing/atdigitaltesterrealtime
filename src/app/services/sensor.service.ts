import { Injectable } from '@angular/core';
import { Observable, of, delay, BehaviorSubject, interval, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  TemperatureSensor,
  SensorReading,
} from '../interfaces/sensor.interface';

// Mock sensors
const MOCK_SENSORS: TemperatureSensor[] = [
  {
    id: 'sensor-001',
    name: 'Transformer T1 Top Oil',
    type: 'PT100',
    status: 'connected',
    location: 'Main Substation - Transformer T1',
    communication: {
      type: 'MODBUS_RTU',
      modbusAddress: 1,
      modbusRegister: 100,
      serialPort: 'COM1',
      baudRate: 9600,
    },
    calibration: {
      offset: 0,
      scale: 1,
      lastCalibrationDate: new Date('2024-10-15'),
      nextCalibrationDate: new Date('2025-04-15'),
    },
    thresholds: {
      warningHigh: 45,
      criticalHigh: 55,
    },
    currentValue: 38.5,
    lastUpdated: new Date(),
    position: { x: 120, y: 180 },
  },
  {
    id: 'sensor-002',
    name: 'Transformer T2 Winding',
    type: 'PT100',
    status: 'connected',
    location: 'Main Substation - Transformer T2',
    communication: {
      type: 'MODBUS_RTU',
      modbusAddress: 2,
      modbusRegister: 100,
      serialPort: 'COM1',
      baudRate: 9600,
    },
    calibration: {
      offset: 0.5,
      scale: 1,
      lastCalibrationDate: new Date('2024-11-01'),
      nextCalibrationDate: new Date('2025-05-01'),
    },
    thresholds: {
      warningHigh: 50,
      criticalHigh: 60,
    },
    currentValue: 32.1,
    lastUpdated: new Date(),
    position: { x: 280, y: 180 },
  },
  {
    id: 'sensor-003',
    name: 'Circuit Breaker CB1',
    type: 'THERMOCOUPLE',
    status: 'connected',
    location: 'Switchgear Room',
    communication: {
      type: 'MODBUS_TCP',
      ipAddress: '192.168.1.50',
      port: 502,
      modbusAddress: 1,
      modbusRegister: 0,
    },
    calibration: {
      offset: 0,
      scale: 1,
      lastCalibrationDate: new Date('2024-09-01'),
      nextCalibrationDate: new Date('2025-03-01'),
    },
    thresholds: {
      warningHigh: 40,
      criticalHigh: 50,
    },
    currentValue: 28.7,
    lastUpdated: new Date(),
    position: { x: 400, y: 250 },
  },
  {
    id: 'sensor-004',
    name: 'Cable Joint CJ-01',
    type: 'INFRARED',
    status: 'alert',
    location: 'Cable Tunnel Section A',
    communication: {
      type: 'IEC104',
      ipAddress: '192.168.1.60',
      port: 2404,
      iec104Ioa: 1001,
    },
    calibration: {
      offset: 0,
      scale: 1,
      lastCalibrationDate: new Date('2024-08-15'),
      nextCalibrationDate: new Date('2025-02-15'),
    },
    thresholds: {
      warningHigh: 35,
      criticalHigh: 45,
    },
    currentValue: 36.8,
    lastUpdated: new Date(),
    position: { x: 500, y: 350 },
  },
  {
    id: 'sensor-005',
    name: 'Busbar Connection B1',
    type: 'PT1000',
    status: 'disconnected',
    location: 'Main Busbar Section',
    communication: {
      type: 'MODBUS_RTU',
      modbusAddress: 5,
      modbusRegister: 100,
      serialPort: 'COM2',
      baudRate: 9600,
    },
    calibration: {
      offset: 0,
      scale: 1,
    },
    thresholds: {
      warningHigh: 45,
      criticalHigh: 55,
    },
    position: { x: 200, y: 100 },
  },
];

@Injectable({
  providedIn: 'root',
})
export class SensorService {
  private sensorsSubject = new BehaviorSubject<TemperatureSensor[]>(MOCK_SENSORS);
  public sensors$ = this.sensorsSubject.asObservable();

  constructor(private http: HttpClient) {
    // Simulate real-time updates
    this.startRealTimeUpdates();
  }

  private startRealTimeUpdates(): void {
    interval(5000).subscribe(() => {
      const sensors = this.sensorsSubject.value.map(sensor => {
        if (sensor.status === 'disconnected' || !sensor.currentValue) return sensor;
        
        return {
          ...sensor,
          currentValue: sensor.currentValue + (Math.random() - 0.5) * 2,
          lastUpdated: new Date(),
        };
      });
      this.sensorsSubject.next(sensors);
    });
  }

  /**
   * Get all sensors
   */
  getAllSensors(): Observable<TemperatureSensor[]> {
    return this.sensors$;
  }

  /**
   * Get sensor by ID
   */
  getSensorById(id: string): Observable<TemperatureSensor | undefined> {
    return this.sensors$.pipe(
      map(sensors => sensors.find(s => s.id === id))
    );
  }

  /**
   * Add new sensor
   */
  addSensor(sensor: Omit<TemperatureSensor, 'id' | 'status' | 'currentValue' | 'lastUpdated'>): Observable<TemperatureSensor> {
    const newSensor: TemperatureSensor = {
      ...sensor,
      id: `sensor-${Date.now()}`,
      status: 'disconnected',
    };
    
    const sensors = [...this.sensorsSubject.value, newSensor];
    this.sensorsSubject.next(sensors);
    
    return of(newSensor).pipe(delay(300));
  }

  /**
   * Update sensor
   */
  updateSensor(id: string, updates: Partial<TemperatureSensor>): Observable<TemperatureSensor | null> {
    const sensors = this.sensorsSubject.value;
    const index = sensors.findIndex(s => s.id === id);
    
    if (index === -1) return of(null);
    
    const updatedSensor = { ...sensors[index], ...updates };
    sensors[index] = updatedSensor;
    this.sensorsSubject.next([...sensors]);
    
    return of(updatedSensor).pipe(delay(300));
  }

  /**
   * Delete sensor
   */
  deleteSensor(id: string): Observable<boolean> {
    const sensors = this.sensorsSubject.value.filter(s => s.id !== id);
    this.sensorsSubject.next(sensors);
    return of(true).pipe(delay(300));
  }

  /**
   * Get sensor reading history
   */
  getSensorHistory(sensorId: string, hours: number = 24): Observable<SensorReading[]> {
    const now = new Date();
    const readings: SensorReading[] = [];
    const sensor = this.sensorsSubject.value.find(s => s.id === sensorId);
    const baseValue = sensor?.currentValue || 30;
    
    for (let i = hours * 2; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 30 * 60 * 1000);
      const variation = Math.sin(i / 6) * 3 + (Math.random() - 0.5) * 2;
      const value = baseValue + variation;
      
      readings.push({
        sensorId,
        value,
        rawValue: value * 100, // Simulate raw ADC value
        unit: 'C',
        timestamp,
        quality: 'good',
      });
    }
    
    return of(readings).pipe(delay(300));
  }

  /**
   * Get summary counts
   */
  getSummaryCounts(): Observable<{ connected: number; alert: number; disconnected: number }> {
    return this.sensors$.pipe(
      map(sensors => ({
        connected: sensors.filter(s => s.status === 'connected').length,
        alert: sensors.filter(s => s.status === 'alert').length,
        disconnected: sensors.filter(s => s.status === 'disconnected').length,
      }))
    );
  }
}


