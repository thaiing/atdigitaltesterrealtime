import { Routes } from '@angular/router';
import { MainLayoutComponent } from './components/layout/main-layout/main-layout.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'e-map',
        loadComponent: () =>
          import('./pages/e-map/e-map.component').then((m) => m.EMapComponent),
      },
      {
        path: 'single-line-diagram',
        loadComponent: () =>
          import('./pages/single-line-diagram/single-line-diagram.component').then((m) => m.SingleLineDiagramComponent),
      },
      // Configuration routes
      {
        path: 'config/thermal-cameras',
        loadComponent: () =>
          import('./pages/configuration/thermal-cameras/thermal-cameras.component').then((m) => m.ThermalCamerasComponent),
      },
      {
        path: 'config/sensors',
        loadComponent: () =>
          import('./pages/configuration/sensors/sensors.component').then((m) => m.SensorsComponent),
      },
      {
        path: 'config/alert-thresholds',
        loadComponent: () =>
          import('./pages/configuration/alert-thresholds/alert-thresholds.component').then((m) => m.AlertThresholdsComponent),
      },
      {
        path: 'config/users',
        loadComponent: () =>
          import('./pages/configuration/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'config/network',
        loadComponent: () =>
          import('./pages/configuration/network/network.component').then((m) => m.NetworkComponent),
      },
      // Alert routes
      {
        path: 'alerts/active',
        loadComponent: () =>
          import('./pages/alerts/alert-list/alert-list.component').then((m) => m.AlertListComponent),
      },
      {
        path: 'alerts/history',
        loadComponent: () =>
          import('./pages/alerts/alert-history/alert-history.component').then((m) => m.AlertHistoryComponent),
      },
      // Reports
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/reports/reports.component').then((m) => m.ReportsComponent),
      },
      // Account
      {
        path: 'account',
        loadComponent: () =>
          import('./pages/account/account.component').then((m) => m.AccountComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];


