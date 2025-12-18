// Temperature sensor types
export type SensorType = 'PT100' | 'PT1000' | 'THERMOCOUPLE' | 'INFRARED' | 'OTHER';
export type SensorStatus = 'connected' | 'alert' | 'disconnected';
export type CommunicationType = 'MODBUS_RTU' | 'MODBUS_TCP' | 'IEC104' | 'ANALOG';

// Temperature sensor configuration
export interface TemperatureSensor {
  id: string;
  name: string;
  type: SensorType;
  status: SensorStatus;
  location: string;
  communication: SensorCommunication;
  calibration: SensorCalibration;
  thresholds: SensorThreshold;
  currentValue?: number;
  lastUpdated?: Date;
  position?: {
    x: number;
    y: number;
    floor?: string;
  };
}

// Communication settings for sensor
export interface SensorCommunication {
  type: CommunicationType;
  // Modbus settings
  modbusAddress?: number;
  modbusRegister?: number;
  modbusFunctionCode?: number;
  // Serial settings
  serialPort?: string;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  // TCP settings
  ipAddress?: string;
  port?: number;
  // IEC 104 settings
  iec104Ioa?: number;
}

// Sensor calibration settings
export interface SensorCalibration {
  offset: number;
  scale: number;
  lastCalibrationDate?: Date;
  nextCalibrationDate?: Date;
}

// Sensor threshold settings
export interface SensorThreshold {
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

// Sensor reading
export interface SensorReading {
  sensorId: string;
  value: number;
  rawValue: number;
  unit: 'C' | 'F';
  timestamp: Date;
  quality: 'good' | 'uncertain' | 'bad';
}


