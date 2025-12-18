// src/app/pages/bms/site-list/site-list.component.ts
import {Component, OnInit, ViewChild, AfterViewInit} from '@angular/core';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

// Import các file liên quan
import {Site, SiteFormData} from '../../../interfaces/site.interface';
import {SiteFormComponent} from '../../../components/dialogs/site-form/site-form.component';
import {ConfirmationComponent} from '../../../components/dialogs/confirmation/confirmation.component';
import {SiteService} from '../../../services/site.service';

@Component({
  selector: 'app-site-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './site-list.component.html',
  styleUrl: './site-list.component.scss',
})
export class SiteListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['siteId', 'siteName', 'actions'];
  dataSource = new MatTableDataSource<Site>([]);
  isLoading = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private router: Router,
    public dialog: MatDialog,
    private siteService: SiteService
  ) {
  }

  ngOnInit(): void {
    this.loadSites();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  loadSites(): void {
    this.isLoading = true;
    this.siteService.getSites().subscribe(
      (data) => {
        this.dataSource.data = data;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading sites:', error);
        this.isLoading = false;
      }
    );
  }

  openSiteForm(site?: Site): void {
    const dialogRef = this.dialog.open(SiteFormComponent, {
      width: '400px',
      data: site ? {...site} : null,
    });

    dialogRef.afterClosed().subscribe((result: SiteFormData | undefined) => {
      if (result) {
        if (site) {
          // *** Xử lý EDIT ***
          this.siteService.updateSite(site.id, result).subscribe(() => {
            this.loadSites();
          });
        } else {
          // *** Xử lý ADD ***
          this.siteService.addSite(result).subscribe(() => {
            this.loadSites();
          });
        }
      }
    });
  }

  deleteSite(site: Site): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '350px',
      data: {
        title: 'Delete Site',
        message: `Are you sure you want to delete site "${site.siteName}"?`,
        type: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.siteService.deleteSite(site.id).subscribe(() => {
          this.loadSites();
        });
      }
    });
  }

  viewStrings(site: Site): void {
    // <<< SỬA ĐƯỜNG DẪN >>>
    this.router.navigate(['/setting/site', site.id, 'strings']);
  }
}
