import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatChipsModule} from '@angular/material/chips';
import {MatMenuModule} from '@angular/material/menu';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {IpsecConnection} from '../../../../../services/vpn.service';

@Component({
  selector: 'app-ipsec-connection-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatSlideToggleModule
  ],
  templateUrl: './ipsec-connection-card.component.html',
  styleUrls: ['./ipsec-connection-card.component.scss']
})
export class IpsecConnectionCardComponent {
  @Input() connection!: IpsecConnection;
  @Output() edit = new EventEmitter<IpsecConnection>();
  @Output() delete = new EventEmitter<IpsecConnection>();
  @Output() start = new EventEmitter<IpsecConnection>();
  @Output() stop = new EventEmitter<IpsecConnection>();

  onToggle(checked: boolean): void {
    if (checked && this.connection.status !== 'ESTABLISHED') {
      this.start.emit(this.connection);
    } else if (!checked && this.connection.status === 'ESTABLISHED') {
      this.stop.emit(this.connection);
    }
  }

  getStatusClass(): string {
    switch (this.connection.status) {
      case 'ESTABLISHED':
        return 'status-established';
      case 'CONNECTING':
        return 'status-connecting';
      case 'IDLE':
        return 'status-idle';
      default:
        return 'status-unknown';
    }
  }

  getStatusIcon(): string {
    switch (this.connection.status) {
      case 'ESTABLISHED':
        return 'check_circle';
      case 'CONNECTING':
        return 'sync';
      case 'IDLE':
        return 'radio_button_unchecked';
      default:
        return 'help_outline';
    }
  }

  isConnected(): boolean {
    return this.connection.status === 'ESTABLISHED';
  }
}
