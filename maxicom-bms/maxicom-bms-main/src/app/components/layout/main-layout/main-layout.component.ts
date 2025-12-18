// src/app/components/layout/main-layout/main-layout.component.ts
import {Component, HostListener, OnInit, OnDestroy} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MatSidenavModule} from '@angular/material/sidenav';
import {HeaderComponent} from '../header/header.component';
import {SidebarComponent} from '../sidebar/sidebar.component';
import {CommonModule} from '@angular/common';
import {SidebarService} from '../../../services/sidebar.service';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    HeaderComponent,
    SidebarComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  isMobile = false;
  private destroy$ = new Subject<void>();

  constructor(private sidebarService: SidebarService) {
  }

  ngOnInit(): void {
    this.checkWidth(window.innerWidth);
    this.sidebarService.isMobile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isMobile) => {
        this.isMobile = isMobile;
      });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.checkWidth((event.target as Window).innerWidth);
  }

  private checkWidth(width: number) {
    this.sidebarService.setIsMobile(width < 768);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
