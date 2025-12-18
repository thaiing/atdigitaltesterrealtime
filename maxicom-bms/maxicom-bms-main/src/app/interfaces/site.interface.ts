// src/app/interfaces/site.interface.ts
export interface Site {
  id: string; // ID duy nhất của hệ thống (ví dụ: '1', 'abc-123')
  siteId: string; // ID mà người dùng nhập (ví dụ: 'S-001')
  siteName: string; // Tên site (ví dụ: 'Kho Doson')
}

// Dữ liệu từ form Add/Edit Site
// Đây chính là { siteId: string, siteName: string }
export type SiteFormData = Pick<Site, 'siteId' | 'siteName'>;
