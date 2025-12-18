// src/app/services/site.service.ts
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {map, catchError} from 'rxjs/operators';
import {LatestValueResponse} from '../interfaces/latest-value.interface';

// Interface for GET result from API
interface ApiRecord {
  record: {
    timestamp: number;
    flag: 'VALID';
    value: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SiteService {
  private readonly BASE_URL = '/api';
  private readonly LATEST_VALUE_API = '/api/latest-value';
  private readonly SITE_NAME_CHANNEL = 'site_name_1';

  constructor(private http: HttpClient) {
  }

  /**
   * Get site name from API
   */
  getSiteName(): Observable<string> {
    return this.http.get<LatestValueResponse<string>>(`${this.LATEST_VALUE_API}/site-name`).pipe(
      map((res) => {
        console.log('[Site] Latest-value API response:', res);
        if (res?.success && typeof res.data === 'string' && res.data.trim().length > 0) {
          return res.data;
        }
        console.warn('[Site] Unexpected latest-value response, falling back to default:', res);
        return 'My Monitoring Site';
      }),
      catchError((err) => {
        console.error('[Site] Could not load site name from latest-value, using default.', err);
        return of('My Monitoring Site');
      })
    );
  }

  /**
   * Update site name via API (PUT)
   */
  setSiteName(name: string): Observable<any> {
    const payload = {
      record: {
        flag: 'VALID',
        value: name,
      },
    };
    console.log('[Site] Saving site name:', name);
    return this.http.put(`${this.BASE_URL}/channels/${this.SITE_NAME_CHANNEL}`, payload).pipe(
      map((res) => {
        console.log('[Site] Site name saved successfully:', res);
        return res;
      }),
      catchError((err) => {
        console.error('[Site] Error saving site name:', err);
        throw err;
      })
    );
  }
}
