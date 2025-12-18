import {Component, Inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';
import {MatDialogModule, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {VpnService} from '../../../services/vpn.service';

@Component({
  selector: 'app-ipsec-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './ipsec-edit-dialog.component.html',
  styleUrls: ['./ipsec-edit-dialog.component.scss']
})
export class IpsecEditDialogComponent {
  form: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    private vpnService: VpnService,
    public dialogRef: MatDialogRef<IpsecEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.isEditMode = !!data && !!data.name;

    this.form = this.fb.group({
      name: [data?.name || '', Validators.required],
      category: [{value: data?.category || 'site-to-site', disabled: this.isEditMode}],
      auth_method: [data?.auth_method || 'ikev2-psk', Validators.required],
      remote_address: [data?.remote_address || '', Validators.required],
      local_identity: [data?.local_identity || ''],
      remote_identity: [data?.remote_identity || ''],
      pre_shared_key: [data?.pre_shared_key || '', this.isEditMode ? [] : Validators.required],
      local_traffic_selector: [data?.local_traffic_selector || '0.0.0.0/0'],
      remote_traffic_selector: [data?.remote_traffic_selector || '0.0.0.0/0']
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formData = {
      ...this.form.getRawValue(),
      andUpdate: true
    };

    console.log('=== DEBUG: Form Data ===', formData);

    const apiCall = this.isEditMode
      ? this.vpnService.updateIpsecConnection(formData.name, formData)
      : this.vpnService.createIpsecConnection(formData);

    apiCall.subscribe({
      next: () => {
        console.log('Connection saved successfully');
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Failed to save connection', err);
        alert('Failed to save connection: ' + (err.error?.error || 'Unknown error'));
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
