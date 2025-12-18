import {Component, Inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatDialogModule, MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

export interface ConfirmationData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss'
})
export class ConfirmationComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationData
  ) {
  }

  onConfirm() {
    this.dialogRef.close(true);
  }

  onCancel() {
    this.dialogRef.close(false);
  }

  getIconName(): string {
    switch (this.data.type) {
      case 'danger':
        return 'warning';
      case 'warning':
        return 'help_outline';
      case 'info':
      default:
        return 'info';
    }
  }

  getIconClass(): string {
    switch (this.data.type) {
      case 'danger':
        return 'icon-danger';
      case 'warning':
        return 'icon-warning';
      case 'info':
      default:
        return 'icon-info';
    }
  }
}
