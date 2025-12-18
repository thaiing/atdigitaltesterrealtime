// Temperature reading from a sensor or camera zone
export interface TemperatureReading {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'sensor' | 'camera_zone';
  value: number;
  unit: 'C' | 'F';
  timestamp: Date;
  status: TemperatureStatus;
}

export type TemperatureStatus = 'normal' | 'warning' | 'critical';

// Temperature trend data point for charts
export interface TemperatureTrendPoint {
  timestamp: Date;
  value: number;
  min?: number;
  max?: number;
  avg?: number;
}

// Temperature statistics
export interface TemperatureStats {
  deviceId: string;
  deviceName: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
  status: TemperatureStatus;
  lastUpdated: Date;
}

// CBM (Condition Based Monitoring) - Temperature difference calculation
export interface TemperatureDifference {
  id: string;
  pointA: {
    deviceId: string;
    deviceName: string;
    value: number;
  };
  pointB: {
    deviceId: string;
    deviceName: string;
    value: number;
  };
  difference: number;
  timestamp: Date;
  status: TemperatureStatus;
}

// Manual measurement
export interface ManualMeasurement {
  id: string;
  pointName: string;
  value: number;
  unit: 'C' | 'F';
  measuredBy: string;
  timestamp: Date;
  notes?: string;
}


