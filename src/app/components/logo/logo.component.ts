import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="logo-container" [class.small]="size === 'small'" [class.large]="size === 'large'">
      <img
        [src]="logoSrc"
        alt="ATDigital Tester Real-time"
        class="logo-image"
      />
    </div>
  `,
  styles: [`
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      
      &.small {
        .logo-image {
          height: 32px;
        }
      }
      
      &.medium {
        .logo-image {
          height: 48px;
        }
      }
      
      &.large {
        .logo-image {
          height: 80px;
          max-width: 100%;
        }
      }
    }
    
    .logo-image {
      height: 40px; 
      width: auto;
      max-width: 200px; // Prevent overflow in sidebar
      object-fit: contain;
    }
  `]
})
export class LogoComponent {
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() variant: 'color' | 'white' = 'color';
  @Input() showText: boolean = false; // Deprecated but kept for compatibility

  get logoSrc(): string {
    // Small size: use key visual icon
    if (this.size === 'small') {
      return 'assets/images/AT%20Energy_Key%20visual.png';
    }
    // Medium/Large: always use the main logo
    return 'assets/images/ATDigital%20Tester%20Real-time.png';
  }
}


