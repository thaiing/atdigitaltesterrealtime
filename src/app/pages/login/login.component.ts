import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { LogoComponent } from '../../components/logo/logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LogoComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  isPasswordHidden = true;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });

    // Redirect if already logged in
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading) return;

    this.isLoading = true;
    const { username, password } = this.loginForm.value;

    this.authService.login({ username, password }).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.authService.showMessage(response.message || 'Login failed', 'error');
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.authService.showMessage('Connection error. Please try again.', 'error');
        console.error('Login error:', err);
      },
    });
  }

  togglePasswordVisibility(): void {
    this.isPasswordHidden = !this.isPasswordHidden;
  }
}


