// Thermal camera types
export type CameraType = 'PTZ' | 'FIXED';
export type CameraStatus = 'connected' | 'alert' | 'disconnected';

// Thermal camera configuration
export interface ThermalCamera {
  id: string;
  name: string;
  type: CameraType;
  brand: string;
  model: string;
  ipAddress: string;
  port: number;
  username?: string;
  password?: string;
  status: CameraStatus;
  streamUrl?: string;
  zones: ThermalZone[];
  lastCalibration?: Date;
  location?: {
    x: number;
    y: number;
    floor?: string;
  };
}

// Thermal zone within a camera's field of view
export interface ThermalZone {
  id: string;
  cameraId: string;
  zoneName: string;
  zoneType: 'polygon' | 'rectangle' | 'line';
  coordinates: ZoneCoordinate[];
  currentTemperature: ZoneTemperature;
  thresholds: ZoneThreshold;
}

export interface ZoneCoordinate {
  x: number;
  y: number;
}

// Temperature data for a zone
export interface ZoneTemperature {
  zoneId: string;
  zoneName: string;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  timestamp: Date;
}

// Temperature thresholds for alerts
export interface ZoneThreshold {
  warningMin?: number;
  warningMax?: number;
  criticalMin?: number;
  criticalMax?: number;
}

// PTZ camera control
export interface PTZControl {
  cameraId: string;
  pan: number;      // -180 to 180
  tilt: number;     // -90 to 90
  zoom: number;     // 1x to 30x (depending on camera)
}

// Camera preset position
export interface CameraPreset {
  id: string;
  cameraId: string;
  name: string;
  pan: number;
  tilt: number;
  zoom: number;
}

// Auto calibration result
export interface CalibrationResult {
  cameraId: string;
  timestamp: Date;
  success: boolean;
  previousOffset: number;
  newOffset: number;
  message?: string;
}


