// src/app/components/layout/sidebar/sidebar.component.ts
import {Component, OnInit, inject} from '@angular/core';
import {MatListModule} from '@angular/material/list';
import {MatIconModule} from '@angular/material/icon';
import {MatExpansionModule} from '@angular/material/expansion';
import {RouterModule} from '@angular/router';
import {CommonModule} from '@angular/common';
import {SidebarService} from '../../../services/sidebar.service';
import {MenuItem} from '../../../interfaces/menu-item.interface';
import {LogoComponent} from '../../logo/logo.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatExpansionModule,
    LogoComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  menuItems: MenuItem[] = [];
  isMobile = false;

  private sidebarService = inject(SidebarService);

  // Sửa lỗi: Cần @ViewChild(MatSidenav) trong main-layout
  // để đóng sidebar khi click.
  // Cách đơn giản hơn là gọi service
  constructor() {
  }

  ngOnInit(): void {
    this.menuItems = this.sidebarService.getMenuItems();
    this.sidebarService.isMobile$.subscribe((isMobile) => {
      this.isMobile = isMobile;
    });
  }

  onLinkClick() {
    // Nếu là mobile, chúng ta cần tìm cách đóng Sidenav.
    // Tạm thời để sau, vì logic này nằm ở main-layout.
    // Khi click link, ta sẽ gọi 1 hàm trong service
    // và main-layout sẽ lắng nghe để đóng sidenav.
  }
}
