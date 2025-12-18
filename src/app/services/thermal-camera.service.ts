import { Injectable } from '@angular/core';
import { Observable, of, delay, BehaviorSubject, interval, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  ThermalCamera,
  ThermalZone,
  ZoneTemperature,
  PTZControl,
  CameraPreset,
  CalibrationResult,
} from '../interfaces/thermal-camera.interface';

// Mock thermal cameras
const MOCK_CAMERAS: ThermalCamera[] = [
  {
    id: 'camera-001',
    name: 'Thermal Camera 1 - Main Substation',
    type: 'PTZ',
    brand: 'Hikvision',
    model: 'DS-2TD4136-50',
    ipAddress: '192.168.1.101',
    port: 80,
    status: 'connected',
    streamUrl: '/api/camera/camera-001/stream',
    zones: [
      {
        id: 'zone-001',
        cameraId: 'camera-001',
        zoneName: 'Transformer T1',
        zoneType: 'rectangle',
        coordinates: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        currentTemperature: {
          zoneId: 'zone-001',
          zoneName: 'Transformer T1',
          avgTemp: 42.5,
          minTemp: 38.2,
          maxTemp: 48.7,
          timestamp: new Date(),
        },
        thresholds: { warningMax: 45, criticalMax: 55 },
      },
      {
        id: 'zone-002',
        cameraId: 'camera-001',
        zoneName: 'Busbar Section A',
        zoneType: 'polygon',
        coordinates: [{ x: 300, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 200 }, { x: 300, y: 200 }],
        currentTemperature: {
          zoneId: 'zone-002',
          zoneName: 'Busbar Section A',
          avgTemp: 35.8,
          minTemp: 32.1,
          maxTemp: 39.4,
          timestamp: new Date(),
        },
        thresholds: { warningMax: 40, criticalMax: 50 },
      },
    ],
    lastCalibration: new Date('2024-12-01'),
    location: { x: 150, y: 200 },
  },
  {
    id: 'camera-002',
    name: 'Thermal Camera 2 - Control Room',
    type: 'FIXED',
    brand: 'FLIR',
    model: 'A400',
    ipAddress: '192.168.1.102',
    port: 80,
    status: 'connected',
    streamUrl: '/api/camera/camera-002/stream',
    zones: [
      {
        id: 'zone-003',
        cameraId: 'camera-002',
        zoneName: 'Panel Board PB1',
        zoneType: 'rectangle',
        coordinates: [{ x: 50, y: 50 }, { x: 250, y: 300 }],
        currentTemperature: {
          zoneId: 'zone-003',
          zoneName: 'Panel Board PB1',
          avgTemp: 28.3,
          minTemp: 25.5,
          maxTemp: 31.2,
          timestamp: new Date(),
        },
        thresholds: { warningMax: 35, criticalMax: 45 },
      },
    ],
    lastCalibration: new Date('2024-11-15'),
    location: { x: 350, y: 150 },
  },
  {
    id: 'camera-003',
    name: 'Thermal Camera 3 - Outdoor',
    type: 'PTZ',
    brand: 'Dahua',
    model: 'TPC-PT8620A',
    ipAddress: '192.168.1.103',
    port: 80,
    status: 'alert',
    zones: [],
    location: { x: 500, y: 300 },
  },
];

@Injectable({
  providedIn: 'root',
})
export class ThermalCameraService {
  private camerasSubject = new BehaviorSubject<ThermalCamera[]>(MOCK_CAMERAS);
  public cameras$ = this.camerasSubject.asObservable();

  constructor(private http: HttpClient) {
    // Simulate real-time temperature updates
    this.startRealTimeUpdates();
  }

  private startRealTimeUpdates(): void {
    interval(3000).subscribe(() => {
      const cameras = this.camerasSubject.value.map(camera => ({
        ...camera,
        zones: camera.zones.map(zone => ({
          ...zone,
          currentTemperature: {
            ...zone.currentTemperature,
            avgTemp: zone.currentTemperature.avgTemp + (Math.random() - 0.5) * 1,
            minTemp: zone.currentTemperature.minTemp + (Math.random() - 0.5) * 0.5,
            maxTemp: zone.currentTemperature.maxTemp + (Math.random() - 0.5) * 1.5,
            timestamp: new Date(),
          },
        })),
      }));
      this.camerasSubject.next(cameras);
    });
  }

  /**
   * Get all thermal cameras
   */
  getAllCameras(): Observable<ThermalCamera[]> {
    return this.cameras$;
  }

  /**
   * Get camera by ID
   */
  getCameraById(id: string): Observable<ThermalCamera | undefined> {
    return this.cameras$.pipe(
      map(cameras => cameras.find(c => c.id === id))
    );
  }

  /**
   * Get all zones with temperatures
   */
  getAllZoneTemperatures(): Observable<ZoneTemperature[]> {
    return this.cameras$.pipe(
      map(cameras => cameras.flatMap(c => c.zones.map(z => z.currentTemperature)))
    );
  }

  /**
   * Add new camera
   */
  addCamera(camera: Omit<ThermalCamera, 'id' | 'status' | 'zones'>): Observable<ThermalCamera> {
    const newCamera: ThermalCamera = {
      ...camera,
      id: `camera-${Date.now()}`,
      status: 'disconnected',
      zones: [],
    };
    
    const cameras = [...this.camerasSubject.value, newCamera];
    this.camerasSubject.next(cameras);
    
    return of(newCamera).pipe(delay(300));
  }

  /**
   * Update camera
   */
  updateCamera(id: string, updates: Partial<ThermalCamera>): Observable<ThermalCamera | null> {
    const cameras = this.camerasSubject.value;
    const index = cameras.findIndex(c => c.id === id);
    
    if (index === -1) return of(null);
    
    const updatedCamera = { ...cameras[index], ...updates };
    cameras[index] = updatedCamera;
    this.camerasSubject.next([...cameras]);
    
    return of(updatedCamera).pipe(delay(300));
  }

  /**
   * Delete camera
   */
  deleteCamera(id: string): Observable<boolean> {
    const cameras = this.camerasSubject.value.filter(c => c.id !== id);
    this.camerasSubject.next(cameras);
    return of(true).pipe(delay(300));
  }

  /**
   * PTZ Control
   */
  movePTZ(cameraId: string, control: PTZControl): Observable<boolean> {
    console.log(`Moving camera ${cameraId}:`, control);
    return of(true).pipe(delay(200));
  }

  /**
   * Go to preset
   */
  goToPreset(cameraId: string, presetId: string): Observable<boolean> {
    console.log(`Camera ${cameraId} going to preset ${presetId}`);
    return of(true).pipe(delay(500));
  }

  /**
   * Run calibration
   */
  runCalibration(cameraId: string): Observable<CalibrationResult> {
    return of({
      cameraId,
      timestamp: new Date(),
      success: true,
      previousOffset: 0.5,
      newOffset: 0.1,
      message: 'Calibration completed successfully',
    }).pipe(delay(2000));
  }

  /**
   * Get camera stream URL
   */
  getStreamUrl(cameraId: string, type: 'thermal' | 'visible' = 'thermal'): string {
    return `/api/camera/${cameraId}/stream?type=${type}`;
  }

  /**
   * Get summary counts
   */
  getSummaryCounts(): Observable<{ connected: number; alert: number; disconnected: number }> {
    return this.cameras$.pipe(
      map(cameras => ({
        connected: cameras.filter(c => c.status === 'connected').length,
        alert: cameras.filter(c => c.status === 'alert').length,
        disconnected: cameras.filter(c => c.status === 'disconnected').length,
      }))
    );
  }
}


