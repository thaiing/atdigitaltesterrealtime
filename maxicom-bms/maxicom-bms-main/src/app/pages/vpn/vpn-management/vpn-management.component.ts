import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { IpsecComponent } from '../ipsec/ipsec.component';
import { OpenvpnComponent } from '../openvpn/openvpn.component';

@Component({
    selector: 'app-vpn-management',
    standalone: true,
    imports: [
        CommonModule,
        MatTabsModule,
        MatIconModule,
        IpsecComponent,
        OpenvpnComponent
    ],
    templateUrl: './vpn-management.component.html',
    styleUrls: ['./vpn-management.component.scss']
})
export class VpnManagementComponent {
    constructor() { }
}
