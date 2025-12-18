import {Routes} from '@angular/router';
import {MainLayoutComponent} from './components/layout/main-layout/main-layout.component';
import {authGuard} from './guards/auth.guard'; // Import Guard

export const routes: Routes = [
  {
    path: 'login', // Route đăng nhập
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard], // BẢO VỆ TẤT CẢ CÁC ROUTE CON
    children: [
      {path: '', redirectTo: 'dashboard', pathMatch: 'full'},
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'setting/strings',
        loadComponent: () =>
          import('./pages/bms/string-list/string-list.component').then(
            (m) => m.StringListComponent
          ),
      },
      {
        path: 'setting/string/:stringId',
        loadComponent: () =>
          import('./pages/bms/string-detail/string-detail.component').then(
            (m) => m.StringDetailComponent
          ),
      },
      {
        path: 'setting/serial',
        loadComponent: () =>
          import('./pages/communication/serial/serial.component').then(
            (m) => m.SerialComponent
          ),
      },
      {
        path: 'setting/network',
        loadComponent: () =>
          import('./pages/communication/network/network.component').then(
            (m) => m.NetworkComponent
          ),
      },
      // Route đổi mật khẩu mới
      {
        path: 'setting/account',
        loadComponent: () =>
          import('./pages/account/account.component').then(
            (m) => m.AccountComponent
          ),
      },
      // VPN Management
      {
        path: 'vpn',
        loadComponent: () =>
          import('./pages/vpn/vpn-management/vpn-management.component').then(
            (m) => m.VpnManagementComponent
          ),
      },
    ],
  },
  {path: '**', redirectTo: ''}, // Chuyển hướng về trang được bảo vệ
];
