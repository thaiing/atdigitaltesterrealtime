// src/app/interfaces/dashboard.interface.ts

// 1. Interface cho trang Dashboard (bảng danh sách)
export interface DashboardItem {
  id: string; // ID của string, dùng để click vào xem chi tiết
  siteName: string;
  stringName: string;
  cellVol: 'On' | 'Off' | string;
  cellRst: 'On' | 'Off' | string;
  stringVol: 'On' | 'Off' | string;
  current: 'On' | 'Off' | string;
  ambient: 'On' | 'Off' | string;
  soC: number | null; // State of Charge (0-100)
  soH: number | null; // State of Health (0-100)
  updateTime: Date;
}

// 2. MỚI: Interface cho 1 Cell (trong trang chi tiết)
export interface CellData {
  cellNumber: number;
  voltage: number;
  temperature: number;
  resistance: number;
  status: 'normal' | 'warning' | 'error';
}

// 3. MỚI: Interface cho trang String Detail
export interface StringDetailData {
  id: string;
  stringName: string;
  siteName: string;
  status: 'Charging' | 'Discharging' | 'Idle';
  soc: number; // State of Charge (0-100)
  soh: number; // State of Health (0-100)
  totalVoltage: number;
  current: number;
  avgTemperature: number;
  minCellVoltage: number;
  maxCellVoltage: number;
  cells: CellData[];
}
