import {Injectable} from '@angular/core';
import {MenuItem} from '../interfaces/menu-item.interface';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  private isMobile = new BehaviorSubject<boolean>(false);
  isMobile$ = this.isMobile.asObservable();

  constructor() {
  }

  public setIsMobile(isMobile: boolean): void {
    this.isMobile.next(isMobile);
  }

  getMenuItems(): MenuItem[] {
    return [
      {
        label: 'Dashboard',
        icon: 'dashboard',
        route: '/dashboard',
      },
      {
        label: 'Setting',
        icon: 'settings',
        children: [
          {
            label: 'Strings',
            icon: 'battery_charging_full',
            route: '/setting/strings',
          },
          {
            label: 'Serial',
            icon: 'cable',
            route: '/setting/serial',
          },
          {
            label: 'Network',
            icon: 'wifi',
            route: '/setting/network',
          },
          // THÊM MỤC NÀY
          {
            label: 'Account',
            icon: 'person',
            route: '/setting/account',
          },
        ],
      },
      // VPN Menu
      {
        label: 'VPN',
        icon: 'vpn_key',
        route: '/vpn',
      },
    ];
  }
}
