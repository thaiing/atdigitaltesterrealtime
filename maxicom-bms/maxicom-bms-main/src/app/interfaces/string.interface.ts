// src/app/interfaces/string.interface.ts

// Đây là dữ liệu cấu hình (lưu trong database)
export interface BatteryString {
  id: string; // ID duy nhất (ví dụ: 'uuid-1234')
  stringIndex: number; // Index của string (ví dụ: 1, 2, 3...)
  stringName: string;
  cellBrand: string;
  cellModel: string;
  cellQty: number;
  ratedCapacity: number; // Cnominal
  nominalVoltage: number; // Vnominal
  serialPortId: string; // ID của port (ví dụ: 'serial0')
}

// Đây là dữ liệu gửi từ Form
export type StringFormData = Omit<BatteryString, 'id' | 'stringIndex'>;
