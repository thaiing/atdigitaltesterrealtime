import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, delay, map } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { User, LoginCredentials, LoginResponse, UserRole, DEFAULT_PERMISSIONS } from '../interfaces/user.interface';

// Mock user for development
const MOCK_USER: User = {
  id: '1',
  username: 'admin',
  email: 'admin@tms.local',
  fullName: 'System Administrator',
  role: 'admin',
  enabled: true,
  createdAt: new Date('2024-01-01'),
  lastLogin: new Date(),
  permissions: DEFAULT_PERMISSIONS['admin'],
};

const MOCK_CREDENTIALS = {
  username: 'admin',
  password: 'admin',
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  private currentUserSubject = new BehaviorSubject<User | null>(null);

  public isLoggedIn$ = this.isLoggedInSubject.asObservable();
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private router: Router,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    // Check session on init
    this.checkSession();
  }

  public get isLoggedIn(): boolean {
    return this.isLoggedInSubject.value;
  }

  public get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private checkSession(): void {
    const sessionActive = sessionStorage.getItem('tms-session') === 'true';
    const storedUser = sessionStorage.getItem('tms-user');
    
    if (sessionActive && storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        this.isLoggedInSubject.next(true);
        this.currentUserSubject.next(user);
      } catch {
        this.clearSession();
      }
    }
  }

  /**
   * Login with credentials
   * Mock implementation - will be replaced with OpenMUC API
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    // Mock login - simulate API delay
    return of(credentials).pipe(
      delay(500),
      map((creds) => {
        if (creds.username === MOCK_CREDENTIALS.username && 
            creds.password === MOCK_CREDENTIALS.password) {
          const user = { ...MOCK_USER, lastLogin: new Date() };
          this.startSession(user);
          return {
            success: true,
            user: user,
            message: 'Login successful',
          };
        }
        return {
          success: false,
          message: 'Invalid username or password',
        };
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
    this.showMessage('Logged out successfully', 'info');
  }

  /**
   * Change password
   */
  changePassword(currentPassword: string, newPassword: string): Observable<boolean> {
    // Mock implementation
    return of(true).pipe(
      delay(500),
      map(() => {
        if (currentPassword === MOCK_CREDENTIALS.password) {
          // In real implementation, this would call API
          this.showMessage('Password changed successfully', 'success');
          return true;
        }
        this.showMessage('Current password is incorrect', 'error');
        return false;
      })
    );
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: keyof User['permissions']): boolean {
    const user = this.currentUser;
    if (!user) return false;
    return user.permissions[permission] === true;
  }

  /**
   * Check if user has role
   */
  hasRole(role: UserRole): boolean {
    return this.currentUser?.role === role;
  }

  private startSession(user: User): void {
    sessionStorage.setItem('tms-session', 'true');
    sessionStorage.setItem('tms-user', JSON.stringify(user));
    this.isLoggedInSubject.next(true);
    this.currentUserSubject.next(user);
  }

  private clearSession(): void {
    sessionStorage.removeItem('tms-session');
    sessionStorage.removeItem('tms-user');
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
  }

  /**
   * Show snackbar message
   */
  public showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: [`${type}-snackbar`],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}


