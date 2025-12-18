// src/app/pages/communication/network/network.component.ts
import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {CommunicationService} from '../../../services/communication.service';
import {NetworkConfig} from '../../../interfaces/communication.interface';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './network.component.html',
  styleUrl: './network.component.scss',
})
export class NetworkComponent implements OnInit {
  isLoading = true;
  networkConfigs: NetworkConfig[] = [];
  // Dictionary để lưu các Form Group
  networkForms: { [key: string]: FormGroup } = {};

  // IP address pattern validation
  private ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private commService: CommunicationService
  ) {
  }

  ngOnInit(): void {
    this.loadNetworkData();
  }

  loadNetworkData(): void {
    this.isLoading = true;
    this.commService.getNetworkConfigs().subscribe(
      (data) => {
        this.networkConfigs = data;
        this.buildForms();
        this.isLoading = false;
      },
      (err) => {
        console.error('Failed to fetch network config', err);
        this.showMessage('Failed to load Network configuration', 'error');
        this.isLoading = false;
      }
    );
  }

  buildForms(): void {
    // Clear old forms
    this.networkForms = {};
    // Create form for each config
    this.networkConfigs.forEach((config) => {
      const form = this.fb.group({
        ipAddress: [
          config.ipAddress || '',
          [Validators.required, Validators.pattern(this.ipPattern)],
        ],
        subnetMask: [
          config.subnetMask || '',
          [Validators.required, Validators.pattern(this.ipPattern)],
        ],
        gateway: [
          config.gateway || '',
          [Validators.pattern(this.ipPattern)], // Đã BỎ Validators.required
        ],
        dns: [
          config.dns || '',
        ],
        dhcp: [config.dhcp],
      });

      // Track DHCP changes
      form.get('dhcp')?.valueChanges.subscribe((isDhcp) => {
        this.toggleStaticIpValidators(form, isDhcp ?? false);
      });

      // Apply initial state
      this.toggleStaticIpValidators(form, config.dhcp);

      this.networkForms[config.id] = form;
    });
  }

  toggleStaticIpValidators(form: FormGroup, isDhcp: boolean): void {
    const fields = ['ipAddress', 'subnetMask', 'gateway', 'dns'];
    fields.forEach((field) => {
      const control = form.get(field);
      if (isDhcp) {
        control?.disable();
      } else {
        control?.enable();
      }
    });
  }

  onSave(configId: string): void {
    const form = this.networkForms[configId];
    if (form.invalid) {
      this.showMessage('Please check the configuration information', 'error');
      form.markAllAsTouched(); // Show errors
      return;
    }

    const configToSave: NetworkConfig = {
      ...this.networkConfigs.find(c => c.id === configId)!, // Get 'id' and 'name'
      ...form.getRawValue(), // Get values from form (including disabled fields like DHCP hidden ones)
    };

    // Disable form while saving
    form.disable();

    this.commService.saveNetworkConfig(configToSave).subscribe(
      (updatedConfig) => {
        this.showMessage(`Saved configuration for ${updatedConfig.name}`, 'success');
        // Update values in array
        const index = this.networkConfigs.findIndex(c => c.id === configId);
        if (index > -1) {
          this.networkConfigs[index] = updatedConfig;
        }
        // Reset form to new state
        form.reset(updatedConfig);
        form.markAsPristine();
        // Re-enable form and apply disable logic based on new DHCP state
        form.enable();
        this.toggleStaticIpValidators(form, updatedConfig.dhcp);
      },
      (err) => {
        this.showMessage('Error saving configuration', 'error');
        console.error('Save failed', err);
        // Re-enable form on error
        form.enable();
        this.toggleStaticIpValidators(form, form.get('dhcp')?.value ?? false);
      }
    );
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [`${type}-snackbar`],
    });
  }
}
