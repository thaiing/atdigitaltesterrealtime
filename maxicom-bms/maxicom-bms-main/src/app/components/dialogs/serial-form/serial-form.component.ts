import {Component, Inject} from '@angular/core';
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
  BaudRate,
  DataBits,
  Parity,
  SerialPortConfig,
  StopBits,
} from '../../../interfaces/communication.interface';

// Data type for dialog
export interface SerialDialogData {
  port: Partial<SerialPortConfig> | null;
  baudRates: readonly BaudRate[];
  dataBits: readonly DataBits[];
  stopBits: readonly StopBits[];
  parityOptions: readonly Parity[];
  availablePorts?: SerialPortDefinition[]; // Available ports to choose from (for Add mode)
  configuredPortIds?: string[]; // IDs of already configured ports (to exclude from dropdown)
}

import {SerialPortDefinition} from '../../../interfaces/communication.interface';

// Return data type (without ID)
export type SerialFormData = Omit<SerialPortConfig, 'id' | 'alias' | 'port'>;

@Component({
  selector: 'app-serial-form',
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
  templateUrl: './serial-form.component.html',
  styleUrls: ['./serial-form.component.scss'],
})
export class SerialFormComponent {
  portForm: FormGroup;
  isEditMode: boolean;
  availablePortsForSelection: SerialPortDefinition[] = [];

  parityDisplayOptions: { value: Parity; viewValue: string }[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<SerialFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SerialDialogData
  ) {
    this.isEditMode = !!this.data.port;
    
    // If Add mode and availablePorts provided, filter out already configured ports
    if (!this.isEditMode && this.data.availablePorts && this.data.configuredPortIds) {
      this.availablePortsForSelection = this.data.availablePorts.filter(
        p => !this.data.configuredPortIds!.includes(p.id)
      );
    }

    this.parityDisplayOptions = this.data.parityOptions.map(option => ({
      value: option,
      viewValue: option.replace('PARITY_', '') // Remove prefix
    }));
    
    this.portForm = this.fb.group({
      portId: [this.data.port?.id || (this.availablePortsForSelection.length > 0 ? this.availablePortsForSelection[0].id : ''), 
               this.isEditMode ? [] : Validators.required], // Only required for Add mode
      baudRate: [this.data.port?.baudRate || 9600, Validators.required],
      dataBits: [this.data.port?.dataBits || 8, Validators.required],
      stopBits: [this.data.port?.stopBits || 1, Validators.required],
      parity: [this.data.port?.parity || 'PARITY_NONE', Validators.required],
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
