// src/app/components/dialogs/schedule-form/schedule-form.component.ts
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
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material/core';
import {CommonModule} from '@angular/common';
import {Schedule, ScheduleFormData} from '../../../interfaces/schedule.interface';

export interface ScheduleDialogData {
  schedule?: Schedule; // For edit mode
}

@Component({
  selector: 'app-schedule-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './schedule-form.component.html',
  styleUrl: './schedule-form.component.scss',
})
export class ScheduleFormComponent implements OnInit {
  scheduleForm: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ScheduleFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ScheduleDialogData
  ) {
    this.isEditMode = !!this.data.schedule;
    const schedule = this.data.schedule;

    // Initialize form with start date/time (defaults to now if creating new)
    const startDate = schedule ? new Date(schedule.startTime) : new Date();

    this.scheduleForm = this.fb.group({
      startDate: [startDate, Validators.required],
      startTime: [this.formatTime(startDate), Validators.required],
      ratedCurrent: [schedule?.ratedCurrent ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  ngOnInit(): void {
    // Additional initialization if needed
  }

  private combineDateTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.scheduleForm.valid) {
      const formValue = this.scheduleForm.value;
      const startTime = this.combineDateTime(formValue.startDate, formValue.startTime);

      const result: ScheduleFormData = {
        startTime: startTime,
        ratedCurrent: Number(formValue.ratedCurrent),
      };
      this.dialogRef.close(result);
    }
  }
}

