// User roles
export type UserRole = 'admin' | 'operator' | 'viewer';

// User definition
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  enabled: boolean;
  createdAt: Date;
  lastLogin?: Date;
  permissions: UserPermissions;
}

// User permissions
export interface UserPermissions {
  // Dashboard
  viewDashboard: boolean;
  
  // E-Map
  viewEMap: boolean;
  
  // Configuration
  viewConfig: boolean;
  editCameras: boolean;
  editSensors: boolean;
  editThresholds: boolean;
  editUsers: boolean;
  editNetwork: boolean;
  
  // Alerts
  viewAlerts: boolean;
  acknowledgeAlerts: boolean;
  
  // Reports
  viewReports: boolean;
  exportReports: boolean;
  
  // System
  systemSettings: boolean;
}

// Default permissions by role
export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    viewDashboard: true,
    viewEMap: true,
    viewConfig: true,
    editCameras: true,
    editSensors: true,
    editThresholds: true,
    editUsers: true,
    editNetwork: true,
    viewAlerts: true,
    acknowledgeAlerts: true,
    viewReports: true,
    exportReports: true,
    systemSettings: true,
  },
  operator: {
    viewDashboard: true,
    viewEMap: true,
    viewConfig: true,
    editCameras: true,
    editSensors: true,
    editThresholds: true,
    editUsers: false,
    editNetwork: false,
    viewAlerts: true,
    acknowledgeAlerts: true,
    viewReports: true,
    exportReports: true,
    systemSettings: false,
  },
  viewer: {
    viewDashboard: true,
    viewEMap: true,
    viewConfig: false,
    editCameras: false,
    editSensors: false,
    editThresholds: false,
    editUsers: false,
    editNetwork: false,
    viewAlerts: true,
    acknowledgeAlerts: false,
    viewReports: true,
    exportReports: false,
    systemSettings: false,
  },
};

// Login credentials
export interface LoginCredentials {
  username: string;
  password: string;
}

// Login response
export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

// Change password request
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}


