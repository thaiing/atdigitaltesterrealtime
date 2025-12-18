// src/app/services/schedule.service.ts
import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable, of, BehaviorSubject, throwError} from 'rxjs';
import {map, catchError, tap, switchMap} from 'rxjs/operators';
import {Schedule, ScheduleFormData, ScheduleStatus} from '../interfaces/schedule.interface';

// Backend DTO interface (matching Java ScheduleDTO)
interface ScheduleDTO {
  id: number; // Long in Java
  strId: string;
  startTime: string; // Format: "2025-11-21T10:52:00" (no milliseconds, no Z)
  endTime: string | null;
  current: number | null; // Real-time current (backend field name)
  soh: number | null;
  state?: string | null; // 'PENDING', 'RUNNING', 'FINISHED', 'STOPPED', 'SUCCESS', 'FAILED'
  dischargeState?: number | null; // 1..5 (PENDING, RUNNING, STOPPED, SUCCESS, FAILED)
  DischargeState?: number | null; // Some responses may use PascalCase
}

// Backend API response format
interface ScheduleApiResponse {
  code: string;
  success: boolean;
  description: string | null;
  data: ScheduleDTO[];
}

@Injectable({
  providedIn: 'root',
})
export class ScheduleService {
  private readonly BASE_URL = '/api';
  private readonly SCHEDULE_API_URL = `/api/schedule`;
  private readonly STORAGE_KEY = 'bms_schedules';

  // In-memory cache (fallback)
  private schedulesCache = new Map<string, Schedule[]>();
  private schedulesSubject = new BehaviorSubject<Map<string, Schedule[]>>(new Map());

  private sortSchedules(list: Schedule[]): Schedule[] {
    return [...list].sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Format date to ISO string with timezone (Z) for backend
   * Backend expects format compatible with java.time.Instant (e.g. 2025-11-22T12:21:00Z)
   */
  private formatDateForBackend(date: Date): string {
    return date.toISOString();
  }

  constructor(private http: HttpClient) {
    // Keep localStorage as fallback for offline scenarios
    this.loadSchedulesFromStorage();
  }

  /**
   * Convert backend DTO to frontend Schedule
   */
  private dtoToSchedule(dto: ScheduleDTO, ratedCurrent?: number): Schedule {
    // Parse date string (format: "2025-11-21T10:52:00" or "2025-11-21T10:52:00.000" - no timezone)
    // Backend returns date without timezone, treat it as local time
    const parseDate = (dateStr: string | null): number | null => {
      if (!dateStr) return null;
      // If no timezone indicator, parse as local time (not UTC)
      if (dateStr.includes('Z') || dateStr.includes('+') || (dateStr.match(/-/g) || []).length > 2) {
        // Has timezone, parse normally
        return new Date(dateStr).getTime();
      }
      // No timezone - parse as local time by creating date manually
      // Format: "2025-11-21T10:52:00" or "2025-11-21T10:52:00.000"
      const [datePart, timePart] = dateStr.split('T');
      if (!datePart || !timePart) return null;
      const [year, month, day] = datePart.split('-').map(Number);
      // Handle time with or without milliseconds
      const timeWithoutMs = timePart.split('.')[0];
      const [hours, minutes, seconds = 0] = timeWithoutMs.split(':').map(Number);
      const date = new Date(year, month - 1, day, hours, minutes, seconds);
      return isNaN(date.getTime()) ? null : date.getTime();
    };

    const backendState = dto.state ?? dto.dischargeState ?? dto.DischargeState ?? null;
    const backendSoh = dto.soh;
    const normalizedSoh = backendSoh === null || backendSoh === undefined
      ? null
      : (backendSoh <= 1 ? backendSoh * 100 : backendSoh);

    return {
      id: dto.id.toString(),
      stringId: dto.strId,
      startTime: parseDate(dto.startTime) || Date.now(),
      endTime: parseDate(dto.endTime),
      ratedCurrent: ratedCurrent || 0, // Backend doesn't return ratedCurrent, use from cache or default
      realTimeCurrent: dto.current, // Map 'current' to 'realTimeCurrent'
      soh: normalizedSoh,
      status: this.mapBackendStatus(backendState), // Map backend state/dischargeState to status
      createdAt: parseDate(dto.startTime) || Date.now(), // Use startTime as createdAt if not available
      updatedAt: Date.now(),
    };
  }

  /**
   * Convert frontend Schedule to backend DTO format for API calls
   * Note: Backend doesn't accept full DTO in requests, only specific fields
   */
  private scheduleToDto(schedule: Schedule): Partial<ScheduleDTO> {
    return {
      id: parseInt(schedule.id, 10),
      strId: schedule.stringId,
      startTime: this.formatDateForBackend(new Date(schedule.startTime)),
      endTime: schedule.endTime ? this.formatDateForBackend(new Date(schedule.endTime)) : null,
      current: schedule.realTimeCurrent, // Map 'realTimeCurrent' to 'current'
      soh: schedule.soh,
      state: this.mapFrontendStatus(schedule.status), // Map 'status' to 'state'
    };
  }

  /**
   * Map backend status to frontend status
   */
  private mapBackendStatus(backendStatus: string | number | null | undefined): ScheduleStatus {
    if (backendStatus === null || backendStatus === undefined) {
      return 'pending';
    }

    if (typeof backendStatus === 'number') {
      const map: Record<number, ScheduleStatus> = {
        1: 'pending',
        2: 'running',
        3: 'stopped',
        4: 'finished',
        5: 'failed',
      };
      return map[backendStatus] || 'pending';
    }

    const upper = backendStatus.toUpperCase();
    if (upper === 'PENDING') return 'pending';
    if (upper === 'RUNNING') return 'running';
    if (upper === 'STOPPED') return 'stopped';
    if (upper === 'FINISHED' || upper === 'SUCCESS') return 'finished';
    if (upper === 'FAILED' || upper === 'FAIL') return 'failed';
    return 'pending'; // default
  }

  /**
   * Map frontend status to backend status
   */
  private mapFrontendStatus(frontendStatus: ScheduleStatus): string {
    const map: Record<ScheduleStatus, string> = {
      'pending': 'PENDING',
      'running': 'RUNNING',
      'finished': 'SUCCESS',
      'stopped': 'STOPPED',
      'failed': 'FAILED',
    };
    return map[frontendStatus] || 'PENDING';
  }

  /**
   * Load schedules from localStorage (fallback)
   */
  private loadSchedulesFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.schedulesCache = new Map(
          Object.entries(data).map(([key, value]) => [
            key,
            (value as Schedule[]).map(item => ({
              ...item,
              endTime: item.endTime ?? null,
            })),
          ])
        );
        this.schedulesSubject.next(new Map(this.schedulesCache));
      }
    } catch (error) {
      console.error('Error loading schedules from storage:', error);
    }
  }

  /**
   * Save schedules to localStorage (fallback)
   */
  private saveSchedulesToStorage(): void {
    try {
      const data = Object.fromEntries(this.schedulesCache);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving schedules to storage:', error);
    }
  }

  /**
   * Update cache and notify subscribers
   */
  private updateCache(stringId: string, schedules: Schedule[]): void {
    this.schedulesCache.set(stringId, schedules);
    this.schedulesSubject.next(new Map(this.schedulesCache));
    this.saveSchedulesToStorage();
  }

  /**
   * Get all schedules for a string from backend
   */
  getSchedules(stringId: string, legacyStringIds: string[] = []): Observable<Schedule[]> {
    return this.http.get<ScheduleApiResponse>(`${this.SCHEDULE_API_URL}/get-list`).pipe(
      map(response => {
        console.log('[Schedule] API response:', response);
        
        // Handle backend response format: { code, success, data: [...] }
        let dtos: ScheduleDTO[] = [];
        if (response && response.success && Array.isArray(response.data)) {
          dtos = response.data;
        } else {
          console.warn('[Schedule] Unexpected response format:', response);
        }

        const allowedIds = new Set([stringId, ...legacyStringIds].filter(Boolean));
        // Filter by stringId (including legacy ids) if backend doesn't filter
        const filtered = dtos.filter(dto => allowedIds.has(dto.strId));
        
        // Convert DTOs to Schedules, preserving ratedCurrent from cache if available
        const schedules = filtered.map(dto => {
          // Try to get ratedCurrent from cache
          const cached = this.schedulesCache.get(stringId) || [];
          const existing = cached.find(s => s.id === dto.id.toString());
          return this.dtoToSchedule(dto, existing?.ratedCurrent);
        });
        
        const sorted = this.sortSchedules(schedules);
        // Update cache
        this.updateCache(stringId, sorted);
        return sorted;
      }),
      catchError(error => {
        console.error('[Schedule] Error fetching schedules from backend:', error);
        if (error.error && typeof error.error === 'string' && error.error.includes('<!DOCTYPE')) {
          console.error('[Schedule] Backend returned HTML instead of JSON. Check proxy configuration.');
        }
        // Fallback to cache
        const cached = this.schedulesCache.get(stringId) || [];
        return of(this.sortSchedules(cached));
      })
    );
  }

  /**
   * Get schedules as observable
   */
  getSchedulesObservable(stringId: string, legacyStringIds: string[] = []): Observable<Schedule[]> {
    // Load from backend first, then emit from cache
    return this.getSchedules(stringId, legacyStringIds).pipe(
      switchMap(() => {
        // After loading, return observable that emits from cache
        return this.schedulesSubject.pipe(
          map(cache => {
            const schedules = cache.get(stringId) || [];
            return this.sortSchedules(schedules);
          })
        );
      })
    );
  }

  /**
   * Create a new schedule
   */
  createSchedule(stringId: string, formData: ScheduleFormData): Observable<Schedule> {
    // Format startTime as ISO string for backend
    // Java LocalDateTime typically accepts: yyyy-MM-ddTHH:mm:ss (no milliseconds)
    const startTimeISO = this.formatDateForBackend(formData.startTime);

    // Backend API expects: strId and startTime
    // Note: ratedCurrent might be stored separately or in a different field
    // For now, we'll send it as a query param if backend supports it, or store locally
    const currentValue = Number.isFinite(formData.ratedCurrent) ? formData.ratedCurrent : null;
    // Build query string manually to avoid HttpParams encoding issues with ':' and 'T'
    const queryString = [`strId=${encodeURIComponent(stringId)}`, `startTime=${encodeURIComponent(startTimeISO)}`];
    if (currentValue !== null) {
      queryString.push(`current=${encodeURIComponent(String(currentValue))}`);
    }
    const fullQuery = queryString.join('&');
    
    console.log('[Schedule] Creating schedule:', { strId: stringId, startTime: startTimeISO, current: currentValue, query: fullQuery });

    return this.http.post<ScheduleApiResponse>(`${this.SCHEDULE_API_URL}/create?${fullQuery}`, null).pipe(
      switchMap(response => {
        // Backend returns toSuccessResultNull() - no data in response
        // If success, reload from get-list to get the created schedule
        if (response && response.success) {
          // Reload schedules from backend to get the newly created one
          return this.getSchedules(stringId).pipe(
            map(schedules => {
              // Find the newly created schedule (most recent with matching startTime)
              const newSchedule = schedules.find(s => 
                Math.abs(s.startTime - formData.startTime.getTime()) < 60000 // Within 1 minute
              );
              if (newSchedule) {
                // Update ratedCurrent from formData
                newSchedule.ratedCurrent = formData.ratedCurrent;
                this.updateCache(stringId, schedules);
                return newSchedule;
              }
              // If not found, create local schedule as fallback
              const schedule: Schedule = {
                id: this.generateId(),
                stringId: stringId,
                startTime: formData.startTime.getTime(),
                endTime: null,
                ratedCurrent: formData.ratedCurrent,
                realTimeCurrent: null,
                soh: null,
                status: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              const updatedSchedules = [schedule, ...schedules];
              this.updateCache(stringId, updatedSchedules);
              return schedule;
            })
          );
        }
        throw new Error('Backend did not return success');
      }),
      catchError(error => {
        console.error('Error creating schedule:', error);
        // Create local schedule as fallback
        const schedule: Schedule = {
          id: this.generateId(),
          stringId: stringId,
          startTime: formData.startTime.getTime(),
          endTime: null,
          ratedCurrent: formData.ratedCurrent,
          realTimeCurrent: null,
          soh: null,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const schedules = [schedule, ...(this.schedulesCache.get(stringId) || [])];
        this.updateCache(stringId, schedules);
        return of(schedule);
      })
    );
  }

  /**
   * Update a schedule
   */
  updateSchedule(stringId: string, scheduleId: string, updates: Partial<ScheduleFormData>): Observable<Schedule> {
    const schedules = [...(this.schedulesCache.get(stringId) || [])];
    const index = schedules.findIndex(s => s.id === scheduleId);

    if (index === -1) {
      return throwError(() => new Error('Schedule not found'));
    }

    const schedule = schedules[index];

    // Backend API expects: id and startTime
    if (!updates.startTime) {
      return throwError(() => new Error('startTime is required for update'));
    }

    const startTimeISO = this.formatDateForBackend(updates.startTime);
    const queryString = `id=${encodeURIComponent(scheduleId)}&startTime=${encodeURIComponent(startTimeISO)}`;

    return this.http.post<ScheduleApiResponse>(`${this.SCHEDULE_API_URL}/update?${queryString}`, null).pipe(
      switchMap(response => {
        // Backend returns toSuccessResultNull() - no data in response
        // If success, reload from get-list to get the updated schedule
        if (response && response.success) {
          return this.getSchedules(stringId).pipe(
            map(updatedSchedules => {
              const updated = updatedSchedules.find(s => s.id === scheduleId);
              if (updated) {
                // Preserve ratedCurrent if provided
                if (updates.ratedCurrent !== undefined) {
                  updated.ratedCurrent = updates.ratedCurrent;
                }
                this.updateCache(stringId, updatedSchedules);
                return updated;
              }
              // If not found, update locally
              const localUpdated: Schedule = {
                ...schedule,
                startTime: updates.startTime!.getTime(),
                ...(updates.ratedCurrent !== undefined && {ratedCurrent: updates.ratedCurrent}),
                updatedAt: Date.now(),
              };
              schedules[index] = localUpdated;
              this.updateCache(stringId, this.sortSchedules(schedules));
              return localUpdated;
            })
          );
        }
        throw new Error('Backend did not return success');
      }),
      catchError(error => {
        console.error('Error updating schedule:', error);
        // Update locally as fallback
        const updated: Schedule = {
          ...schedule,
          startTime: updates.startTime!.getTime(),
          ...(updates.ratedCurrent !== undefined && {ratedCurrent: updates.ratedCurrent}),
          updatedAt: Date.now(),
        };
        schedules[index] = updated;
        this.updateCache(stringId, this.sortSchedules(schedules));
        return of(updated);
      })
    );
  }

  /**
   * Update schedule status and real-time data
   */
  updateScheduleStatus(
    stringId: string,
    scheduleId: string,
    status: ScheduleStatus,
    realTimeCurrent?: number,
    soh?: number,
    endTime?: number | null,
  ): Observable<Schedule> {
    const schedules = this.schedulesCache.get(stringId) || [];
    const index = schedules.findIndex(s => s.id === scheduleId);

    if (index === -1) {
      throw new Error('Schedule not found');
    }

    const schedule = schedules[index];
    const computedEndTime = endTime !== undefined
      ? endTime
      : (status === 'finished' || status === 'stopped')
        ? Date.now()
        : schedule.endTime;

    const updated: Schedule = {
      ...schedule,
      status,
      endTime: computedEndTime,
      ...(realTimeCurrent !== undefined && {realTimeCurrent}),
      ...(soh !== undefined && {soh}),
      updatedAt: Date.now(),
    };

    const nextSchedules = [...schedules];
    nextSchedules[index] = updated;
    this.schedulesCache.set(stringId, this.sortSchedules(nextSchedules));
    this.saveSchedulesToStorage();
    this.schedulesSubject.next(new Map(this.schedulesCache));

    return of(updated);
  }

  /**
   * Delete a schedule
   */
  deleteSchedule(stringId: string, scheduleId: string): Observable<boolean> {
    const queryString = `id=${encodeURIComponent(scheduleId)}`;

    return this.http.post<{ data?: any }>(`${this.SCHEDULE_API_URL}/delete?${queryString}`, null).pipe(
      map(() => {
        // Remove from cache
        const schedules = this.schedulesCache.get(stringId) || [];
        const filtered = schedules.filter(s => s.id !== scheduleId);
        this.updateCache(stringId, this.sortSchedules(filtered));
        return true;
      }),
      catchError(error => {
        console.error('Error deleting schedule:', error);
        // Remove from cache anyway as fallback
        const schedules = this.schedulesCache.get(stringId) || [];
        const filtered = schedules.filter(s => s.id !== scheduleId);
        this.updateCache(stringId, this.sortSchedules(filtered));
        return of(false);
      })
    );
  }

  /**
   * Stop a running schedule
   */
  stopSchedule(stringId: string, scheduleId: string): Observable<Schedule> {
    const queryString = `id=${encodeURIComponent(scheduleId)}`;
    const schedules = [...(this.schedulesCache.get(stringId) || [])];
    const existing = schedules.find(s => s.id === scheduleId);

    return this.http.post<ScheduleApiResponse>(`${this.SCHEDULE_API_URL}/stop?${queryString}`, null).pipe(
      switchMap(response => {
        // Backend returns toSuccessResultNull() - no data in response
        // If success, reload from get-list to get the stopped schedule
        if (response && response.success) {
          return this.getSchedules(stringId).pipe(
            map(updatedSchedules => {
              const updated = updatedSchedules.find(s => s.id === scheduleId);
              if (updated) {
                // Preserve ratedCurrent from existing
                if (existing) {
                  updated.ratedCurrent = existing.ratedCurrent;
                }
                this.updateCache(stringId, updatedSchedules);
                return updated;
              }
              // If not found, update locally and return
              const localUpdated: Schedule = {
                ...existing!,
                status: 'stopped',
                endTime: Date.now(),
                updatedAt: Date.now(),
              };
              const index = schedules.findIndex(s => s.id === scheduleId);
              if (index !== -1) {
                schedules[index] = localUpdated;
                this.updateCache(stringId, this.sortSchedules(schedules));
              }
              return localUpdated;
            })
          );
        }
        throw new Error('Backend did not return success');
      }),
      catchError(error => {
        console.error('Error stopping schedule:', error);
        // Fallback to local update
        return this.updateScheduleStatus(stringId, scheduleId, 'stopped', undefined, undefined, Date.now());
      })
    );
  }

  /**
   * Generate a simple ID
   */
  private generateId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

