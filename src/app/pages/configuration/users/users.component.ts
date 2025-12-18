import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { User, DEFAULT_PERMISSIONS } from '../../../interfaces/user.interface';

const MOCK_USERS: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@tms.local',
    fullName: 'System Administrator',
    role: 'admin',
    enabled: true,
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
    permissions: DEFAULT_PERMISSIONS['admin'],
  },
  {
    id: '2',
    username: 'operator1',
    email: 'operator@tms.local',
    fullName: 'Station Operator',
    role: 'operator',
    enabled: true,
    createdAt: new Date('2024-06-15'),
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    permissions: DEFAULT_PERMISSIONS['operator'],
  },
  {
    id: '3',
    username: 'viewer1',
    email: 'viewer@tms.local',
    fullName: 'Guest Viewer',
    role: 'viewer',
    enabled: true,
    createdAt: new Date('2024-10-01'),
    permissions: DEFAULT_PERMISSIONS['viewer'],
  },
];

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTableModule, MatChipsModule, MatTooltipModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  users = MOCK_USERS;
  displayedColumns = ['fullName', 'username', 'email', 'role', 'enabled', 'lastLogin', 'actions'];

  addUser(): void {
    alert('Add user dialog would open');
  }

  editUser(user: User): void {
    alert(`Edit user: ${user.fullName}`);
  }

  deleteUser(user: User): void {
    if (confirm(`Delete user "${user.fullName}"?`)) {
      this.users = this.users.filter((u) => u.id !== user.id);
    }
  }

  getRoleClass(role: string): string {
    return `role-${role}`;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}


