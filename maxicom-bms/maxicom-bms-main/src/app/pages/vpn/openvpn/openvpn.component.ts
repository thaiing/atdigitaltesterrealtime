import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-openvpn',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    templateUrl: './openvpn.component.html',
    styleUrls: ['./openvpn.component.scss']
})
export class OpenvpnComponent {
    constructor() { }
}
