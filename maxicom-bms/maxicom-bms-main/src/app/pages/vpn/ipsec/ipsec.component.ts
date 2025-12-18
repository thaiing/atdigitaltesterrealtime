import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {VpnService, IpsecConnection} from '../../../services/vpn.service';
import {IpsecConnectionCardComponent} from './components/ipsec-connection-card/ipsec-connection-card.component';
import {IpsecEditDialogComponent} from '../../../components/dialogs/ipsec-edit-dialog/ipsec-edit-dialog.component';

@Component({
  selector: 'app-ipsec',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    IpsecConnectionCardComponent
  ],
  templateUrl: './ipsec.component.html',
  styleUrls: ['./ipsec.component.scss']
})
export class IpsecComponent implements OnInit {
  siteToSiteConnections: IpsecConnection[] = [];
  remoteAccessConnections: IpsecConnection[] = [];
  loading = false;

  constructor(
    private vpnService: VpnService,
    private dialog: MatDialog
  ) {
  }

  ngOnInit(): void {
    this.loadConnections();
  }

  loadConnections(): void {
    this.loading = true;
    this.vpnService.getIpsecConnections().subscribe({
      next: (data) => {
        this.siteToSiteConnections = data.filter(c =>
          c.category === 'site-to-site'
        );
        this.remoteAccessConnections = data.filter(c =>
          c.category === 'remote-access'
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load connections', err);
        this.loading = false;
        // Set empty arrays on error
        this.siteToSiteConnections = [];
        this.remoteAccessConnections = [];
      }
    });
  }

  addConnection(category: 'site-to-site' | 'remote-access'): void {
    const dialogRef = this.dialog.open(IpsecEditDialogComponent, {
      width: '600px',
      data: {category}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadConnections();
      }
    });
  }

  editConnection(connection: IpsecConnection): void {
    const dialogRef = this.dialog.open(IpsecEditDialogComponent, {
      width: '600px',
      data: connection
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadConnections();
      }
    });
  }

  deleteConnection(connection: IpsecConnection): void {
    if (confirm(`Delete connection "${connection.name}"?`)) {
      this.vpnService.deleteIpsecConnection(connection.name).subscribe({
        next: () => this.loadConnections(),
        error: (err) => console.error('Delete failed', err)
      });
    }
  }

  startConnection(connection: IpsecConnection): void {
    this.vpnService.startIpsecConnection(connection.name).subscribe({
      next: () => {
        console.log('Connection started');
        setTimeout(() => this.loadConnections(), 1000);
      },
      error: (err) => console.error('Start failed', err)
    });
  }

  stopConnection(connection: IpsecConnection): void {
    this.vpnService.stopIpsecConnection(connection.name).subscribe({
      next: () => {
        console.log('Connection stopped');
        setTimeout(() => this.loadConnections(), 1000);
      },
      error: (err) => console.error('Stop failed', err)
    });
  }
}
