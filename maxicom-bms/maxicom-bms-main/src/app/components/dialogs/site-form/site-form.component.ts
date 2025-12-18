// src/app/components/dialogs/site-form/site-form.component.ts
import {Component, Inject, OnInit} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {Site} from '../../../interfaces/site.interface';

@Component({
  selector: 'app-site-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './site-form.component.html',
  styleUrl: './site-form.component.scss',
})
export class SiteFormComponent implements OnInit {
  siteForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<SiteFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Site | null
  ) {
    this.siteForm = this.fb.group({
      siteId: ['', Validators.required],
      siteName: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    if (this.data) {
      // Nếu là edit, fill data vào form
      this.siteForm.patchValue(this.data);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.siteForm.valid) {
      this.dialogRef.close(this.siteForm.value);
    }
  }
}
