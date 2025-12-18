// src/app/services/thermal-camera.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { catchError, switchMap, shareReplay, tap } from 'rxjs/operators';
import { ThermalZonesResponse, ZoneTemperature } from '../interfaces/thermal-camera.interface';

const POLLING_INTERVAL = 5000; // 5 seconds

@Injectable({
    providedIn: 'root',
})
export class ThermalCameraService {
    private zonesApiUrl = '/api/thermal-camera/radiometry/zones';

    private zonesData$: Observable<ZoneTemperature[] | null> | null = null;

    constructor(private http: HttpClient) { }

    /**
     * Get all thermal zones data with auto-polling
     */
    getThermalZonesData(): Observable<ZoneTemperature[] | null> {
        if (!this.zonesData$) {
            this.zonesData$ = timer(0, POLLING_INTERVAL).pipe(
                switchMap(() => this.fetchZonesData()),
                shareReplay(1)
            );
        }
        return this.zonesData$;
    }

    /**
     * Fetch all zones data from API
     */
    private fetchZonesData(): Observable<ZoneTemperature[] | null> {
        return this.http.get<ThermalZonesResponse>(this.zonesApiUrl).pipe(
            tap(data => {
                console.log('[ThermalCameraService] Zones data received:', data);
            }),
            catchError(error => {
                console.error('[ThermalCameraService] Error fetching zones data:', error);
                return of(null);
            }),
            // Extract zones array from response
            switchMap(response => of(response?.zones ?? null))
        );
    }

    /**
     * Get zones data once (without polling)
     */
    getThermalZonesDataOnce(): Observable<ZoneTemperature[] | null> {
        return this.fetchZonesData();
    }
}
