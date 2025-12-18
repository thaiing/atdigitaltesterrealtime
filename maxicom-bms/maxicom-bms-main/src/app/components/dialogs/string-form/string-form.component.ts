// src/app/components/dialogs/string-form/string-form.component.ts
import {Component, Inject, OnInit} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {
  BatteryString,
  StringFormData,
} from '../../../interfaces/string.interface';
import {SerialPortConfig} from '../../../interfaces/communication.interface';

export interface StringDialogData {
  string: BatteryString | null;
  serialPorts: SerialPortConfig[];
}

@Component({
  selector: 'app-string-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './string-form.component.html',
  styleUrl: './string-form.component.scss',
})
export class StringFormComponent implements OnInit {
  stringForm: FormGroup;
  serialPorts: SerialPortConfig[] = [];
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<StringFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StringDialogData
  ) {
    this.isEditMode = !!data.string;
    this.serialPorts = data.serialPorts;

    const currentString = data.string;

    this.stringForm = this.fb.group({
      stringName: [currentString?.stringName || '', Validators.required],
      cellBrand: [currentString?.cellBrand || 'Unknown', Validators.required],
      cellModel: [currentString?.cellModel || 'Unknown', Validators.required],
      cellQty: [
        currentString?.cellQty || 24,
        [Validators.required, Validators.min(1), Validators.max(250)],
      ],
      ratedCapacity: [
        currentString?.ratedCapacity || 100,
        [Validators.required, Validators.min(1)],
      ],
      nominalVoltage: [
        currentString?.nominalVoltage || 3.2,
        [Validators.required, Validators.min(1)],
      ],
      serialPortId: [
        currentString?.serialPortId || null,
        Validators.required,
      ],
    });
  }

  ngOnInit(): void {
    if (this.serialPorts.length === 0) {
      // Vô hiệu hóa trường serial nếu không có port nào
      this.stringForm.get('serialPortId')?.disable();
    }
  }

  onSave(): void {
    if (this.stringForm.valid) {
      // Trả về dữ liệu thô, bao gồm cả ID (nếu có)
      this.dialogRef.close(this.stringForm.value as StringFormData);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
