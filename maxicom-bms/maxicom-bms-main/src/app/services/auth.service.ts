// src/app/services/auth.service.ts
import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {BehaviorSubject, Observable, forkJoin, of} from 'rxjs';
import {map, catchError, switchMap, tap} from 'rxjs/operators';
import {MatSnackBar} from '@angular/material/snack-bar';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';

// Interface for GET result from API
interface ApiRecord {
  record: {
    timestamp: number;
    flag: 'VALID';
    value: string | number | boolean;
  };
}

// Interface for latest-value account API response
interface LatestValueAccountResponse {
  code: string;
  success: boolean;
  description: string | null;
  data: {
    username: string;
    password: string;
  };
}

// Interface for latest-value account update request
interface LatestValueAccountUpdateRequest {
  accountID: number;
  password: string;
}

// Interface for latest-value API response (generic)
interface LatestValueResponse<T> {
  code: string;
  success: boolean;
  description: string | null;
  data: T | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly BASE_URL = '/api'; // Proxy will handle it
  private readonly LATEST_VALUE_API = '/api/latest-value'; // New service API

  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  constructor(
    private router: Router,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    // Check session
    const sessionActive = sessionStorage.getItem('session-active') === 'true';
    this.isLoggedInSubject.next(sessionActive);
  }

  public get isLoggedIn(): boolean {
    return this.isLoggedInSubject.value;
  }

  /**
   * Login by comparing with API
   * Uses new latest-value service API
   */
  login(username: string, password: string): Observable<boolean> {
    // Try new API first
    const params = new HttpParams().set('accountID', '1');
    return this.http.get<LatestValueAccountResponse>(
      `${this.LATEST_VALUE_API}/account`,
      {params}
    ).pipe(
      map((response) => {
        if (response?.success && response.data) {
          const storedUser = response.data.username;
          const storedPass = response.data.password;

          if (username === storedUser && password === storedPass) {
            this.startSession();
            return true;
          }

          this.showMessage('Incorrect username or password.', 'error');
          return false;
        }

        this.showMessage('Invalid response from authentication server.', 'error');
        return false;
      }),
      catchError((err) => {
        console.error('Error during login (latest-value API):', err);
        // Fallback to old OpenMUC channels API
        return this.loginFallback(username, password);
      })
    );
  }

  /**
   * Fallback login using OpenMUC channels (for backward compatibility)
   */
  private loginFallback(username: string, password: string): Observable<boolean> {
    const user$ = this.http.get<ApiRecord>(
      `${this.BASE_URL}/channels/account_1_username`
    );
    const pass$ = this.http.get<ApiRecord>(
      `${this.BASE_URL}/channels/account_1_password`
    );

    return forkJoin([user$, pass$]).pipe(
      map(([userRes, passRes]) => {
        const storedUser = userRes.record.value as string;
        const storedPass = passRes.record.value as string;

        if (username === storedUser && password === storedPass) {
          this.startSession();
          return true;
        }

        this.showMessage('Incorrect username or password.', 'error');
        return false;
      }),
      catchError((err) => {
        console.error('Error during login (fallback):', err);
        this.showMessage('Could not connect to authentication server.', 'error');
        return of(false);
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem('session-active');
    this.isLoggedInSubject.next(false);
    this.router.navigate(['/login']);
  }

  /**
   * Change password via API
   * Uses new latest-value service API
   */
  changePassword(oldPass: string, newPass: string): Observable<boolean> {
    // 1. Get current account info to verify old password
    const params = new HttpParams().set('accountID', '1');
    return this.http.get<LatestValueAccountResponse>(
      `${this.LATEST_VALUE_API}/account`,
      {params}
    ).pipe(
      switchMap((response) => {
        if (!response?.success || !response.data) {
          this.showMessage('Could not verify old password.', 'error');
          return of(false);
        }

        const storedPass = response.data.password;
        // 2. Compare old password
        if (oldPass !== storedPass) {
          this.showMessage('Incorrect old password.', 'error');
          return of(false);
        }

        // 3. Update password using new API
        const updatePayload: LatestValueAccountUpdateRequest = {
          accountID: 1,
          password: newPass
        };

        return this.http.put<LatestValueResponse<null>>(
          `${this.LATEST_VALUE_API}/account`,
          updatePayload
        ).pipe(
          map((updateResponse) => {
            if (updateResponse?.success) {
              this.showMessage('Password changed successfully.', 'success');
              return true;
            } else {
              this.showMessage(updateResponse?.description || 'Error saving new password.', 'error');
              return false;
            }
          }),
          catchError((err) => {
            console.error('Error when changing password (latest-value API):', err);
            // Fallback to old OpenMUC channels API
            return this.changePasswordFallback(oldPass, newPass);
          })
        );
      }),
      catchError((err) => {
        console.error('Error when verifying old password (latest-value API):', err);
        // Fallback to old OpenMUC channels API
        return this.changePasswordFallback(oldPass, newPass);
      })
    );
  }

  /**
   * Fallback change password using OpenMUC channels (for backward compatibility)
   */
  private changePasswordFallback(oldPass: string, newPass: string): Observable<boolean> {
    // 1. Get old password
    return this.http
      .get<ApiRecord>(`${this.BASE_URL}/channels/account_1_password`)
      .pipe(
        switchMap((passRes) => {
          const storedPass = passRes.record.value as string;
          // 2. Compare old password
          if (oldPass !== storedPass) {
            this.showMessage('Incorrect old password.', 'error');
            return of(false);
          }
          // 3. Overwrite with new password (PUT)
          return this.apiPutChannel('account_1_password', newPass).pipe(
            map(() => {
              this.showMessage('Password changed successfully.', 'success');
              return true;
            }),
            catchError((err) => {
              console.error('Error when changing password (fallback):', err);
              this.showMessage('Error saving new password.', 'error');
              return of(false);
            })
          );
        })
      );
  }

  private startSession(): void {
    sessionStorage.setItem('session-active', 'true');
    this.isLoggedInSubject.next(true);
  }

  // === Helper ===
  private apiPutChannel(
    channelId: string,
    value: string | number | boolean
  ): Observable<any> {
    const payload = {
      record: {
        flag: 'VALID',
        value: value,
      },
    };
    return this.http.put(`${this.BASE_URL}/channels/${channelId}`, payload);
  }

  public showMessage(message: string, type: 'success' | 'error' | 'info') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [`${type}-snackbar`],
    });
  }
}

