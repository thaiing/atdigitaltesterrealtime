// src/app/services/openmuc.service.ts
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of, timer, combineLatest} from 'rxjs';
import {catchError, map, switchMap, shareReplay, distinctUntilChanged} from 'rxjs/operators';
import {DashboardItem} from '../interfaces/dashboard.interface';

// Interface cho data Summary (Đã cập nhật)
export interface StringSummaryData {
  stringName: string | null;
  cellQty: number | null;
  updateTime: number | null;
  rstUpdateTime: number | null;

  totalVoltage: number | null;     // str*_string_vol (V)
  stringCurrent: number | null;  // str*_total_I (A)
  avgVoltage: number | null;     // str*_average_vol (V)
  avgTemp: number | null;        // str*_average_temp (°C)
  avgRst: number | null;         // str*_average_rst (* 100000 -> µΩ)

  maxVolId: number | null;         // str*_max_voltage_cell_id
  minVolId: number | null;         // str*_min_voltage_cell_id
  maxRstId: number | null;         // str*_max_rst_cell_id
  minRstId: number | null;         // str*_min_rst_cell_id
  maxTempId: number | null;        // str*_max_temp_cell_id
  minTempId: number | null;        // str*_min_temp_cell_id

  maxVoltageValue: number | null;  // str*_max_voltage_value
  minVoltageValue: number | null;  // str*_min_voltage_value
  maxRstValue: number | null;      // str*_max_rst_value
  minRstValue: number | null;      // str*_min_rst_value
  maxTempValue: number | null;     // str*_max_temp_value
  minTempValue: number | null;     // str*_min_temp_value

  stringSoC: number | null;        // str*_string_SOC
  stringSoH: number | null;        // str*_string_SOH
}

// Interface cho 1 cell (Đã cập nhật)
export interface CellData {
  ID: number;
  Vol: number | null;    // str*_cell**_V (V)
  Temp: number | null;   // str*_cell**_T (°C)
  Rst: number | null;    // str*_cell**_R (Raw)
  IR: number | null;     // (R_raw * I_raw)
  SoC: number | null;    // str*_cell**_SOC (%)
  SoH: number | null;    // str*_cell**_SOH (%)
}

interface OpenMucRecord {
  id: string;
  valueType: string;
  record: {
    timestamp: number;
    flag: 'VALID' | 'INVALID';
    value: any; // number | string | boolean
  };
}

interface OpenMucDeviceResponse {
  records: OpenMucRecord[];
  state: string;
}

// === THÊM INTERFACE NÀY ===
// Interface cho API /rest/devices
interface OpenMucDevicesResponse {
  devices: string[];
}

// ==========================

type RecordMap = Map<string, OpenMucRecord['record']>;
const POLLING_INTERVAL = 1000;

@Injectable({
  providedIn: 'root',
})
export class OpenmucService {
  // SỬA LẠI: API LÀ /devices, không phải /channels
  // proxy.conf.json sẽ đổi /api -> /rest
  private devicesApiUrl = '/api/devices';
  private channelsApiUrl = '/api/channels';
  private deviceCache = new Map<string, Observable<RecordMap>>();

  constructor(private http: HttpClient) {
  }

  /**
   * (HÀM MỚI) Lấy TẤT CẢ records của 1 device và chuyển thành Map
   * Tự động poll mỗi 1 giây.
   */
  private getDeviceRecords(deviceId: string): Observable<RecordMap> {
    if (!this.deviceCache.has(deviceId)) {
      const observable = timer(0, POLLING_INTERVAL).pipe( // Bắt đầu ngay, lặp lại mỗi POLLING_INTERVAL
        switchMap(() =>
          this.http.get<OpenMucDeviceResponse>(`${this.devicesApiUrl}/${deviceId}`)
        ),
        map(response => {
          const recordMap = new Map<string, OpenMucRecord['record']>();
          if (response && response.records) {
            for (const item of response.records) {
              if (item.record.flag === 'VALID') {
                recordMap.set(item.id, item.record);
              }
            }
          }
          return recordMap;
        }),
        shareReplay(1), // Cache và chia sẻ kết quả cho mọi subscriber
        catchError(err => {
          console.error(`Lỗi khi gọi API cho device: ${deviceId}`, err);
          return of(new Map<string, OpenMucRecord['record']>()); // Trả về map rỗng nếu lỗi
        })
      );
      this.deviceCache.set(deviceId, observable);
    }
    // Trả về observable đã cache
    return this.deviceCache.get(deviceId)!;
  }

  private getValue(map: RecordMap, key: string): any {
    return map.get(key)?.value ?? null;
  }

  private getTimestamp(map: RecordMap, key: string): number | null {
    return map.get(key)?.timestamp ?? null;
  }

  // === CÁC HÀM XỬ LÝ DỮ LIỆU THÔ ===
  // Dựa trên JSON: V, I cần /1000; T cần /100

  private getAsVolts(map: RecordMap, key: string): number | null {
    const val = this.getValue(map, key);
    // Dữ liệu từ _virtual (avg, max, min, string_vol) đã là float, không cần chia
    // Dữ liệu từ _modbus (cell V) là int (ví dụ 2099), cần chia 1000
    if (typeof val === 'number') {
      return key.includes('_cell') ? val / 1000 : val;
    }
    return null;
  }

  private getAsAmps(map: RecordMap, key: string): number | null {
    const val = this.getValue(map, key); // str*_total_I (ví dụ 4998)
    return typeof val === 'number' ? val / 100 : null; // -> 4.998
  }

  private getAsCelsius(map: RecordMap, key: string): number | null {
    const val = this.getValue(map, key);
    // Dữ liệu từ _virtual (avg, max, min) đã là float, không cần chia
    // Dữ liệu từ _modbus (cell T) là int (ví dụ 2781), cần chia 100
    if (typeof val === 'number') {
      return key.includes('_cell') ? val / 100 : val; // -> 27.81
    }
    return null;
  }

  private getAsRaw(map: RecordMap, key: string): number | null {
    const val = this.getValue(map, key);
    return typeof val === 'number' ? val : null;
  }

  private getAsString(map: RecordMap, key: string): string | null {
    const val = this.getValue(map, key);
    return typeof val === 'string' ? val : null;
  }


  /**
   * (VIẾT LẠI) Lấy data tóm tắt cho trang Chi tiết String
   */
  getSummaryData(baseStringName: string): Observable<StringSummaryData> {
    return combineLatest({
      virtual: this.getDeviceRecords(`${baseStringName}_virtual`),
      modbus: this.getDeviceRecords(`${baseStringName}_modbus`)
    }).pipe(
      map(({virtual, modbus}) => {

        // Lấy giá trị Avg Rst (Ohm) và convert sang µΩ theo yêu cầu
        const avgRstOhm = this.getValue(virtual, `${baseStringName}_average_rst`);
        const avgRstMicroOhm = (avgRstOhm !== null) ? avgRstOhm * 100000 : null; // * 10^5

        const summary: StringSummaryData = {
          // Header Info (Từ _virtual)
          stringName: this.getAsString(virtual, `${baseStringName}_string_name`),
          cellQty: this.getAsRaw(virtual, `${baseStringName}_cell_qty`),
          updateTime: this.getTimestamp(virtual, `${baseStringName}_string_vol`),
          rstUpdateTime: this.getTimestamp(virtual, `${baseStringName}_average_rst`),

          // String Data Table (Gộp)
          totalVoltage: this.getAsVolts(virtual, `${baseStringName}_string_vol`),
          stringCurrent: this.getAsAmps(modbus, `${baseStringName}_total_I`),
          avgVoltage: this.getAsVolts(virtual, `${baseStringName}_average_vol`),
          avgTemp: this.getAsCelsius(virtual, `${baseStringName}_average_temp`),
          avgRst: avgRstMicroOhm, // Đã convert

          maxVolId: this.getAsRaw(virtual, `${baseStringName}_max_voltage_cell_id`),
          minVolId: this.getAsRaw(virtual, `${baseStringName}_min_voltage_cell_id`),
          maxRstId: this.getAsRaw(virtual, `${baseStringName}_max_rst_cell_id`),
          minRstId: this.getAsRaw(virtual, `${baseStringName}_min_rst_cell_id`),
          maxTempId: this.getAsRaw(virtual, `${baseStringName}_max_temp_cell_id`),
          minTempId: this.getAsRaw(virtual, `${baseStringName}_min_temp_cell_id`), // Sửa typo của bạn

          maxVoltageValue: this.getAsVolts(virtual, `${baseStringName}_max_voltage_value`),
          minVoltageValue: this.getAsVolts(virtual, `${baseStringName}_min_voltage_value`),
          maxRstValue: this.getValue(virtual, `${baseStringName}_max_rst_value`), // Sửa typo của bạn (đơn vị Ohm)
          minRstValue: this.getValue(virtual, `${baseStringName}_min_rst_value`), // (đơn vị Ohm)
          maxTempValue: this.getAsCelsius(virtual, `${baseStringName}_max_temp_value`),
          minTempValue: this.getAsCelsius(virtual, `${baseStringName}_min_temp_value`),

          stringSoC: this.getAsRaw(virtual, `${baseStringName}_string_SOC`),
          stringSoH: this.getAsRaw(virtual, `${baseStringName}_string_SOH`),
        };
        return summary;
      }),
      shareReplay(1) // Cache kết quả đã gộp
    );
  }

  /**
   * (VIẾT LẠI) Lấy dữ liệu cho TẤT CẢ các Cell
   */
  getCellsData(
    baseStringName: string,
    cellQty: number
  ): Observable<CellData[]> {
    return combineLatest({
      virtual: this.getDeviceRecords(`${baseStringName}_virtual`),
      modbus: this.getDeviceRecords(`${baseStringName}_modbus`)
    }).pipe(
      map(({virtual, modbus}) => {
        const cells: CellData[] = [];

        // Lấy dòng điện tổng (giá trị thô, chưa chia 100)
        const totalIRaw = this.getAsRaw(modbus, `${baseStringName}_total_I`);

        for (let i = 1; i <= cellQty; i++) {
          const rstRaw = this.getAsRaw(modbus, `${baseStringName}_cell${i}_R`);

          // Tính IR: str1_cell1_R * str1_total_I / 10^6
          const irCalculated = (rstRaw !== null && totalIRaw !== null) ? (rstRaw * totalIRaw) / 100000 : null;

          cells.push({
            ID: i,
            // Từ _modbus (đã convert)
            Vol: this.getAsVolts(modbus, `${baseStringName}_cell${i}_V`),
            Temp: this.getAsCelsius(modbus, `${baseStringName}_cell${i}_T`),
            Rst: rstRaw, // Lấy giá trị Rst thô (41, 46, 50...)

            // Từ _virtual (thường là %)
            SoC: this.getAsRaw(virtual, `${baseStringName}_cell${i}_SOC`),
            SoH: this.getAsRaw(virtual, `${baseStringName}_cell${i}_SOH`),

            // Giá trị tính toán
            IR: irCalculated,
          });
        }
        return cells;
      }),
      shareReplay(1) // Cache kết quả đã gộp
    );
  }

  /**
   * (CẬP NHẬT) Lấy data cho Dashboard
   * Giờ đây nó sẽ tự động phát hiện string
   */
  getDashboardStatus(): Observable<DashboardItem[]> {
    // 1. Gọi API /api/devices (chỉ 1 lần)
    return this.http.get<OpenMucDevicesResponse>(this.devicesApiUrl).pipe(
      switchMap(response => {
        // 2. Lọc ra các device virtual
        const virtualDevices = response.devices.filter(d => d.endsWith('_virtual'));

        // 3. Với mỗi device, tạo 1 observable để lấy tên thật (poll)
        const deviceDataObservables = virtualDevices.map(virtualName => {
          const baseId = virtualName.replace('_virtual', '');
          // Lấy cả 2 map (virtual và modbus) để có đủ thông tin
          return combineLatest({
            virtualMap: this.getDeviceRecords(virtualName),
            modbusMap: this.getDeviceRecords(`${baseId}_modbus`)
          }).pipe(
            map(({virtualMap, modbusMap}) => {
              // Kiểm tra data thực tế để quyết định On/Off
              const avgVol = this.getAsVolts(virtualMap, `${baseId}_average_vol`);
              const avgRst = this.getValue(virtualMap, `${baseId}_average_rst`);
              const stringVol = this.getAsVolts(virtualMap, `${baseId}_string_vol`);
              const current = this.getAsAmps(modbusMap, `${baseId}_total_I`);
              const avgTemp = this.getAsCelsius(virtualMap, `${baseId}_average_temp`);
              const cellQty = this.getAsRaw(virtualMap, `${baseId}_cell_qty`);
              const soC = this.getAsRaw(virtualMap, `${baseId}_string_SOC`);
              const soH = this.getAsRaw(virtualMap, `${baseId}_string_SOH`);

              // Logic: Có data và hợp lệ (> 0 cho số) thì On, ngược lại Off
              const cellVolStatus = (avgVol !== null && avgVol > 0) || (cellQty !== null && cellQty > 0) ? 'On' : 'Off';
              const cellRstStatus = (avgRst !== null && avgRst > 0) ? 'On' : 'Off';
              const stringVolStatus = (stringVol !== null && stringVol > 0) ? 'On' : 'Off';
              const currentStatus = (current !== null && current !== 0) ? 'On' : 'Off'; // Current có thể âm nên check !== 0
              const ambientStatus = (avgTemp !== null && avgTemp !== 0) ? 'On' : 'Off'; // Temp có thể âm nên check !== 0

              return {
                id: baseId, // 'str1'
                siteName: 'Lego Bình Thuận (Default)', // Will be overridden by dashboard component from SiteService
                stringName: this.getAsString(virtualMap, `${baseId}_string_name`) || baseId,
                cellVol: cellVolStatus,
                cellRst: cellRstStatus,
                stringVol: stringVolStatus,
                current: currentStatus,
                ambient: ambientStatus,
                soC: soC,
                soH: soH,
                updateTime: this.getTimestamp(virtualMap, `${baseId}_string_vol`) ?
                  new Date(this.getTimestamp(virtualMap, `${baseId}_string_vol`)!) : new Date()
              } as DashboardItem;
            })
          );
        });

        if (deviceDataObservables.length === 0) {
          // Sửa lỗi TS2552
          return of<DashboardItem[]>([]);
        }

        // 4. Gộp kết quả (combineLatest sẽ tự động poll vì getDeviceRecords poll)
        return combineLatest(deviceDataObservables);
      }),
      shareReplay(1)
    );
  }

  /**
   * Get channel history data
   * @param channelId Channel ID (e.g., 'str1_string_SOC')
   * @param from Start timestamp (milliseconds)
   * @param until End timestamp (milliseconds)
   */
  getChannelHistory(channelId: string, from: number, until: number): Observable<Array<{
    timestamp: number,
    value: number
  }>> {
    return this.http.get<any>(`${this.channelsApiUrl}/${channelId}/history`, {
      params: {
        from: from.toString(),
        until: until.toString()
      }
    }).pipe(
      map(response => {
        console.log(`[OpenMUC] History response for ${channelId}:`, response);

        // Parse response - adjust based on actual API response structure
        if (Array.isArray(response)) {
          const parsed = response.map((item: any) => ({
            timestamp: item.timestamp || item.time || 0,
            value: typeof item.value === 'number' ? item.value : (item.record?.value ? parseFloat(item.record.value) : 0)
          }));
          console.log(`[OpenMUC] Parsed array data for ${channelId}:`, parsed);
          return parsed;
        }
        // If response has records array
        if (response.records && Array.isArray(response.records)) {
          const parsed = response.records
            .filter((r: any) => r.record?.flag === 'VALID')
            .map((r: any) => ({
              timestamp: r.record.timestamp || 0,
              value: typeof r.record.value === 'number' ? r.record.value : parseFloat(r.record.value || 0)
            }));
          console.log(`[OpenMUC] Parsed records data for ${channelId}:`, parsed);
          return parsed;
        }
        // If response is an object with data array
        if (response.data && Array.isArray(response.data)) {
          const parsed = response.data.map((item: any) => ({
            timestamp: item.timestamp || item.time || 0,
            value: typeof item.value === 'number' ? item.value : parseFloat(item.value || 0)
          }));
          console.log(`[OpenMUC] Parsed data array for ${channelId}:`, parsed);
          return parsed;
        }
        console.warn(`[OpenMUC] Unknown response format for ${channelId}:`, response);
        return [];
      }),
      catchError(err => {
        console.error(`Error loading history for channel ${channelId}:`, err);
        return of([]);
      })
    );
  }
}
