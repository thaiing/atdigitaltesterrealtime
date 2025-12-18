// src/app/components/logo/logo.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="logo-container" [class.small]="size === 'small'" [class.medium]="size === 'medium'" [class.large]="size === 'large'">
      <img [src]="logoPath" alt="MAXiCom Logo" class="logo-image">
    </div>
  `,
  styles: [`
    .logo-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .logo-image {
      object-fit: contain;
    }

    .logo-container.small .logo-image {
      height: 30px;
    }

    .logo-container.medium .logo-image {
      height: 45px;
    }

    .logo-container.large .logo-image {
      height: 55px;
    }
  `]
})
export class LogoComponent {
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  logoPath = 'assets/MAXiCom Logo.png';
}


