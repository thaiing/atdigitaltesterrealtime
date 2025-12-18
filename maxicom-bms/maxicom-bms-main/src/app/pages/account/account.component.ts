import {Component} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  ValidationErrors,
} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {AuthService} from '../../services/auth.service';

// Custom validator to check if new passwords match
export const passwordMatchValidator = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('newPassword');
  const confirmPassword = control.get('confirmPassword');
  if (
    password &&
    confirmPassword &&
    password.value !== confirmPassword.value
  ) {
    return {passwordMismatch: true};
  }
  return null;
};

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  passwordForm: FormGroup;
  isOldHidden = true;
  isNewHidden = true;
  isConfirmHidden = true;
  isLoading = false; // Add loading state

  constructor(private fb: FormBuilder, private authService: AuthService) {
    // ... (form group remains unchanged) ...
    this.passwordForm = this.fb.group(
      {
        oldPassword: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      {validators: passwordMatchValidator}
    );
  }

  onSubmit(): void {
    if (this.passwordForm.invalid || this.isLoading) {
      return;
    }

    this.isLoading = true; // Start loading
    const {oldPassword, newPassword} = this.passwordForm.value;

    // === FIX API CALL LOGIC ===
    this.authService.changePassword(oldPassword, newPassword).subscribe((success) => {
      this.isLoading = false; // Stop loading
      if (success) {
        this.passwordForm.reset();
        // Need to reset validator to remove "mismatch" error
        Object.keys(this.passwordForm.controls).forEach(key => {
          this.passwordForm.get(key)?.setErrors(null);
        });
        this.passwordForm.setErrors(null);
      }
    });
  }
}
