// Alert types
export type AlertType = 'temperature' | 'device' | 'system' | 'calibration';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

// Alert definition
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  deviceId: string;
  deviceName: string;
  deviceType: 'sensor' | 'camera' | 'system';
  title: string;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  notes?: string;
}

// Alert threshold configuration
export interface AlertThreshold {
  id: string;
  name: string;
  description?: string;
  deviceType: 'sensor' | 'camera' | 'all';
  deviceIds?: string[];  // Specific devices, or empty for all
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifySound?: boolean;
}

export interface AlertCondition {
  type: 'above' | 'below' | 'range' | 'change';
  value?: number;           // For 'above' and 'below'
  minValue?: number;        // For 'range'
  maxValue?: number;        // For 'range'
  changeAmount?: number;    // For 'change' (rate of change)
  changePeriod?: number;    // In seconds
}

// Alert statistics
export interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  bySeverity: {
    info: number;
    warning: number;
    critical: number;
  };
  byType: {
    temperature: number;
    device: number;
    system: number;
    calibration: number;
  };
}

// Alert notification settings
export interface AlertNotificationSettings {
  emailEnabled: boolean;
  emailRecipients: string[];
  smsEnabled: boolean;
  smsRecipients: string[];
  soundEnabled: boolean;
  repeatInterval: number;  // In minutes, 0 = no repeat
}


