import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MenuItem } from '../interfaces/menu-item.interface';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  private isMobileSubject = new BehaviorSubject<boolean>(false);
  private isCollapsedSubject = new BehaviorSubject<boolean>(false);
  private activeAlertsCountSubject = new BehaviorSubject<number>(0);

  public isMobile$ = this.isMobileSubject.asObservable();
  public isCollapsed$ = this.isCollapsedSubject.asObservable();
  public activeAlertsCount$ = this.activeAlertsCountSubject.asObservable();

  constructor() {
    this.checkScreenSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.checkScreenSize());
    }
  }

  private checkScreenSize(): void {
    if (typeof window !== 'undefined') {
      this.isMobileSubject.next(window.innerWidth < 768);
    }
  }

  public setIsMobile(isMobile: boolean): void {
    this.isMobileSubject.next(isMobile);
  }

  public toggleCollapsed(): void {
    this.isCollapsedSubject.next(!this.isCollapsedSubject.value);
  }

  public setCollapsed(collapsed: boolean): void {
    this.isCollapsedSubject.next(collapsed);
  }

  public updateActiveAlertsCount(count: number): void {
    this.activeAlertsCountSubject.next(count);
  }

  /**
   * Get menu items for sidebar
   */
  getMenuItems(): MenuItem[] {
    const alertsCount = this.activeAlertsCountSubject.value;
    
    return [
      {
        label: 'Dashboard',
        icon: 'dashboard',
        route: '/dashboard',
      },
      {
        label: 'E-Map',
        icon: 'map',
        route: '/e-map',
      },
      {
        label: 'Single Line Diagram',
        icon: 'account_tree',
        route: '/single-line-diagram',
      },
      {
        label: 'Alerts',
        icon: 'notifications',
        badge: alertsCount > 0 ? alertsCount : undefined,
        badgeColor: 'warn',
        children: [
          {
            label: 'Active Alerts',
            icon: 'warning',
            route: '/alerts/active',
            badge: alertsCount > 0 ? alertsCount : undefined,
            badgeColor: 'warn',
          },
          {
            label: 'Alert History',
            icon: 'history',
            route: '/alerts/history',
          },
        ],
      },
      {
        label: 'Configuration',
        icon: 'settings',
        children: [
          {
            label: 'Thermal Cameras',
            icon: 'videocam',
            route: '/config/thermal-cameras',
          },
          {
            label: 'Temperature Sensors',
            icon: 'thermostat',
            route: '/config/sensors',
          },
          {
            label: 'Alert Thresholds',
            icon: 'tune',
            route: '/config/alert-thresholds',
          },
          {
            label: 'User Management',
            icon: 'people',
            route: '/config/users',
          },
          {
            label: 'Network',
            icon: 'wifi',
            route: '/config/network',
          },
        ],
      },
      {
        label: 'Reports',
        icon: 'assessment',
        route: '/reports',
      },
    ];
  }
}


