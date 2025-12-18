// src/app/components/layout/header/header.component.ts
import {Component, EventEmitter, Output, OnInit, OnDestroy} from '@angular/core'; // Add OnInit, OnDestroy
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {AuthService} from '../../../services/auth.service';
import {SohWarningService} from '../../../services/soh-warning.service';
import {CommonModule, DatePipe} from '@angular/common'; // Add DatePipe
import {MatTooltipModule} from '@angular/material/tooltip'; // Add Tooltip
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule, // Add
    DatePipe, // Add
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() menuToggle = new EventEmitter<void>();

  currentTime: Date = new Date();
  private timerId: any;
  totalLowSohCells = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private sohWarningService: SohWarningService
  ) {
  }

  ngOnInit(): void {
    // Update clock every second
    this.timerId = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
    
    // Subscribe to SoH warning count
    this.sohWarningService.totalLowSohCells$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.totalLowSohCells = count;
      });
  }

  ngOnDestroy(): void {
    // Cancel timer when component is destroyed
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  logout(): void {
    this.authService.logout();
  }
}
