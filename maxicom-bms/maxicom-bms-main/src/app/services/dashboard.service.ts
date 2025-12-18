// src/app/services/dashboard.service.ts
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {delay} from 'rxjs/operators'; // Thêm delay để giả lập loading
import {
  DashboardItem,
  StringDetailData,
  CellData,
} from '../interfaces/dashboard.interface';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  // private apiUrl = '/api/dashboard'; // URL API của bạn

  constructor(private http: HttpClient) {
  }

  /**
   * (Hàm cũ) Lấy dữ liệu cho bảng Dashboard
   */
  getDashboardData(): Observable<DashboardItem[]> {
    // Khi có API: return this.http.get<DashboardItem[]>(this.apiUrl);
    return of([]); // Tạm thời trả về rỗng, vì component dashboard đang dùng MOCK_DATA
  }

  /**
   * (Hàm MỚI) Lấy dữ liệu chi tiết cho 1 String
   */
  getStringDetailData(id: string): Observable<StringDetailData> {
    console.log(`API: Fetching details for string: ${id}`);
    // Khi có API, bạn sẽ dùng:
    // return this.http.get<StringDetailData>(`${this.apiUrl}/string/${id}`);

    // --- Tạm thời trả về MOCK DATA để test UI ---
    const mockCells: CellData[] = [];
    for (let i = 1; i <= 16; i++) {
      mockCells.push({
        cellNumber: i,
        voltage: 3.2 + Math.random() * 0.1, // 3.2V - 3.3V
        temperature: 24 + Math.random() * 2, // 24°C - 26°C
        resistance: 1.5 + Math.random() * 0.5, // 1.5mΩ - 2.0mΩ
        status: 'normal',
      });
    }
    // Tạo 1 cell lỗi để test UI (theo logic trong component của bạn)
    mockCells[5].voltage = 2.9; // < 3.0 (sẽ là lỗi)
    mockCells[5].status = 'error';
    mockCells[10].temperature = 36; // > 35 (sẽ là warning)
    mockCells[10].status = 'warning';

    const MOCK_DETAIL_DATA: StringDetailData = {
      id: id,
      stringName: id === 's1-1' ? 'Dàn 1' : 'String Giả Lập',
      siteName: id === 's1-1' ? 'Lego Bình Thuận' : 'Site Giả Lập',
      status: 'Charging',
      soc: 85,
      soh: 98,
      totalVoltage: mockCells.reduce((a, b) => a + b.voltage, 0),
      current: 10.5,
      avgTemperature:
        mockCells.reduce((a, b) => a + b.temperature, 0) / mockCells.length,
      minCellVoltage: 2.9,
      maxCellVoltage: 3.3,
      cells: mockCells,
    };

    // Thêm delay 500ms để bạn thấy được trạng thái isLoading
    return of(MOCK_DETAIL_DATA).pipe(delay(500));
  }
}
