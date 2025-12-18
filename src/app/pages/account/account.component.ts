import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  passwordForm: FormGroup;
  isLoading = false;
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  currentUser$ = this.authService.currentUser$;

  constructor() {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(4)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) return;

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      this.authService.showMessage('Passwords do not match', 'error');
      return;
    }

    this.isLoading = true;
    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: (success) => {
        this.isLoading = false;
        if (success) {
          this.passwordForm.reset();
        }
      },
      error: () => {
        this.isLoading = false;
        this.authService.showMessage('Error changing password', 'error');
      },
    });
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
}


