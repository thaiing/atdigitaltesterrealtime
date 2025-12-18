import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {AuthService} from '../../services/auth.service';
import {LogoComponent} from '../../components/logo/logo.component';

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
    LogoComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isPasswordHidden = true;
  isLoading = false; // Add loading state

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['admin', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading) {
      return;
    }

    this.isLoading = true; // Start loading
    const {username, password} = this.loginForm.value;

    // === FIX API CALL LOGIC ===
    this.authService.login(username, password).subscribe((loginSuccess) => {
      this.isLoading = false; // Stop loading
      if (loginSuccess) {
        this.router.navigate(['/dashboard']);
      }
      // (AuthService will automatically show an error snackbar on failure)
    });
  }
}
