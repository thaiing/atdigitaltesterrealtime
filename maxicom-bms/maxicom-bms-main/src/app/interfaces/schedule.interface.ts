// src/app/interfaces/schedule.interface.ts

export type ScheduleStatus = 'pending' | 'running' | 'finished' | 'stopped' | 'failed';

export interface Schedule {
  id: string; // UUID
  stringId: string; // ID của string (uuid)
  startTime: number; // Unix timestamp (ms)
  endTime: number | null; // Unix timestamp (ms) - null until completed
  ratedCurrent: number; // Rated Current (A)
  realTimeCurrent: number | null; // Real-time Current từ OpenMUC (A)
  soh: number | null; // SoH từ OpenMUC (%)
  status: ScheduleStatus;
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}

export interface ScheduleFormData {
  startTime: Date;
  ratedCurrent: number;
}

