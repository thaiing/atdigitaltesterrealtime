import { Component, Output, EventEmitter, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { AlertService } from '../../../services/alert.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() menuToggle = new EventEmitter<void>();

  private authService = inject(AuthService);
  private alertService = inject(AlertService);
  private router = inject(Router);
  private location = inject(Location);
  private subscriptions: Subscription[] = [];

  currentUser$ = this.authService.currentUser$;
  activeAlertsCount$ = this.alertService.getActiveAlertsCount();
  
  canGoBack = false;
  currentPageTitle = '';
  private navigationHistory: string[] = [];
  
  private pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/e-map': 'E-Map',
    '/single-line-diagram': 'Single Line Diagram',
    '/alerts/active': 'Active Alerts',
    '/alerts/history': 'Alert History',
    '/config/thermal-cameras': 'Thermal Cameras',
    '/config/sensors': 'Temperature Sensors',
    '/config/alert-thresholds': 'Alert Thresholds',
    '/config/users': 'User Management',
    '/config/network': 'Network',
    '/reports': 'Reports',
    '/account': 'Account Settings',
  };

  ngOnInit(): void {
    // Track navigation
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        const navEvent = event as NavigationEnd;
        const url = navEvent.urlAfterRedirects;
        
        // Update current page title
        this.currentPageTitle = this.pageTitles[url] || '';
        
        // Track history for back navigation
        if (this.navigationHistory.length === 0 || 
            this.navigationHistory[this.navigationHistory.length - 1] !== url) {
          this.navigationHistory.push(url);
          // Keep only last 10 entries
          if (this.navigationHistory.length > 10) {
            this.navigationHistory.shift();
          }
        }
        
        // Can go back if we have more than 1 page in history and not on dashboard
        this.canGoBack = this.navigationHistory.length > 1 && url !== '/dashboard';
      });
    this.subscriptions.push(navSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  goBack(): void {
    if (this.navigationHistory.length > 1) {
      // Remove current page from history
      this.navigationHistory.pop();
      // Get the previous page
      const previousPage = this.navigationHistory[this.navigationHistory.length - 1];
      this.router.navigate([previousPage]);
    } else {
      // Fallback to dashboard
      this.router.navigate(['/dashboard']);
    }
  }

  navigateToAlerts(): void {
    this.router.navigate(['/alerts/active']);
  }

  navigateToAccount(): void {
    this.router.navigate(['/account']);
  }

  logout(): void {
    this.authService.logout();
  }
}

