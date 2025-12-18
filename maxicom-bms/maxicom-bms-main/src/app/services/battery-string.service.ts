// src/app/services/battery-string.service.ts
import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {Observable, of, throwError, forkJoin, BehaviorSubject, timer} from 'rxjs';
import {catchError, map, switchMap, tap, filter, take, delay, retryWhen, mergeMap} from 'rxjs/operators';
import {
  BatteryString,
  StringFormData,
} from '../interfaces/string.interface';
import {SerialPortConfig, SerialPortDefinition} from '../interfaces/communication.interface';
import {ConfigService} from './config.service';
import {v4 as uuidv4} from 'uuid'; // npm install uuid && npm install @types/uuid
import {LatestValueResponse} from '../interfaces/latest-value.interface';

interface LatestStringDetailDto {
  stringName?: string;
  cellBrand?: string;
  cellModel?: string;
  cellQty?: number;
  cnominal?: number;
  vnominal?: number;
}

@Injectable({
  providedIn: 'root',
})
export class BatteryStringService {
  private readonly BASE_URL = '/api';
  private readonly latestValueApiUrl = '/api/latest-value';
  private readonly STORAGE_KEY = 'maxicom-strings-config';
  private readonly MAX_STRING_SCAN = 12;
  private stringsState: BatteryString[] = [];
  private isLoadingFromApi = false; // Flag to prevent multiple loads
  private stringsLoadedSubject = new BehaviorSubject<boolean>(false); // Track loading state
  private readonly serialPortDefinitions: SerialPortDefinition[] = [];

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
  ) {
    this.serialPortDefinitions = this.configService.serialPorts;
    this.loadStringsFromStorage();
    this.stringsLoadedSubject.next(false);
    this.loadStringsFromApi();
  }

  /**
   * Load strings from localStorage (cache)
   */
  private loadStringsFromStorage(): void {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        this.stringsState = JSON.parse(storedData);
      }
    } catch (e) {
      console.error("Error reading String config from localStorage", e);
      this.stringsState = [];
    }
  }

  private fetchStringDetailFromLatestValue(stringIndex: number): Observable<LatestStringDetailDto | null> {
    const params = new HttpParams().set('stringId', stringIndex.toString());
    return this.http.get<LatestValueResponse<LatestStringDetailDto>>(
      `${this.latestValueApiUrl}/string`,
      {params}
    ).pipe(
      map(response => (response?.success ? response.data : null)),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status !== 400) {
          console.warn(`[Strings] Latest-value string API failed for stringId=${stringIndex}`, err);
        }
        return of(null);
      })
    );
  }

  private buildStringIndicesToCheck(forceScanAll: boolean = false): number[] {
    const existingIndices = this.stringsState.map(s => s.stringIndex);

    if (forceScanAll) {
      const scanIndices = Array.from({length: this.MAX_STRING_SCAN}, (_, i) => i + 1);
      const unique = Array.from(new Set([...existingIndices, ...scanIndices]))
        .filter(index => index > 0)
        .sort((a, b) => a - b);
      return unique;
    }

    return existingIndices
      .filter(index => index > 0)
      .sort((a, b) => a - b);
  }

  private hasStringDetail(dto: LatestStringDetailDto | null): boolean {
    if (!dto) return false;
    if (dto.stringName && dto.stringName.trim().length > 0) return true;
    if (dto.cellBrand && dto.cellBrand.trim().length > 0) return true;
    if (dto.cellModel && dto.cellModel.trim().length > 0) return true;
    if (typeof dto.cellQty === 'number') return true;
    if (typeof dto.cnominal === 'number') return true;
    if (typeof dto.vnominal === 'number') return true;
    return false;
  }

  private mapLatestValueDtoToBatteryString(
    dto: LatestStringDetailDto,
    baseId: string,
    stringIndex: number,
    existing?: BatteryString
  ): BatteryString {
    const normalize = (value?: number | null, fallback?: number): number => {
      if (value === null || value === undefined) {
        return fallback ?? 0;
      }
      const num = Number(value);
      return Number.isFinite(num) ? num : (fallback ?? 0);
    };

    return {
      id: existing?.id || uuidv4(),
      stringIndex,
      stringName: dto.stringName?.trim() || existing?.stringName || baseId,
      cellQty: normalize(dto.cellQty, existing?.cellQty),
      cellBrand: dto.cellBrand ?? existing?.cellBrand ?? '',
      cellModel: dto.cellModel ?? existing?.cellModel ?? '',
      ratedCapacity: normalize(dto.cnominal, existing?.ratedCapacity),
      nominalVoltage: normalize(dto.vnominal, existing?.nominalVoltage),
      serialPortId: existing?.serialPortId || '',
    };
  }

  private saveStringsToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.stringsState));
  }

  private loadStringsFromApi(forceScanAll: boolean = false): void {
    if (this.isLoadingFromApi) return;
    this.isLoadingFromApi = true;

    const loadSource$ = forceScanAll
      ? this.getStringIndicesFromOpenMUC().pipe(
        map(openmucIndices => {
          return openmucIndices
            .filter(index => index > 0)
            .sort((a, b) => a - b);
        }),
        catchError(err => {
          console.warn('[Strings] Failed to get devices from OpenMUC, using cache indices:', err);
          return of(this.buildStringIndicesToCheck(forceScanAll));
        })
      )
      : of(this.buildStringIndicesToCheck(forceScanAll));

    loadSource$.pipe(
      switchMap(indicesToCheck => {
        if (indicesToCheck.length === 0) {
          if (forceScanAll) {
            this.stringsState = [];
            this.saveStringsToStorage();
          }
          this.isLoadingFromApi = false;
          this.stringsLoadedSubject.next(true);
          return of([]);
        }

        const existingByIndex = new Map(this.stringsState.map(s => [s.stringIndex, s]));
        const validIndicesSet = forceScanAll ? new Set(indicesToCheck) : null;

        const latestValueRequests = indicesToCheck.map(index => {
          return this.fetchStringDetailFromLatestValue(index).pipe(
            map(dto => ({index, dto, source: 'latest-value' as const})),
            catchError(err => {
              if (err instanceof HttpErrorResponse && err.status !== 400) {
                console.warn(`[Strings] Failed to load latest-value for str${index}:`, err);
              }
              return of({index, dto: null, source: 'latest-value' as const});
            })
          );
        });

        return forkJoin(latestValueRequests).pipe(
          switchMap(results => {
            const missingIndices = results
              .filter(r => !r.dto || !this.hasStringDetail(r.dto))
              .map(r => r.index);

            if (missingIndices.length === 0) {
              return of(results);
            }

            const openmucRequests = missingIndices.map(index => {
              return this.fetchStringDetailFromOpenMUC(index).pipe(
                map(dto => ({index, dto, source: 'openmuc' as const})),
                catchError(() => of({index, dto: null, source: 'openmuc' as const}))
              );
            });

            return forkJoin(openmucRequests).pipe(
              map(openmucResults => {
                const resultMap = new Map<number, {
                  index: number,
                  dto: LatestStringDetailDto | null,
                  source: string
                }>();
                results.forEach(r => resultMap.set(r.index, r));
                openmucResults.forEach(r => {
                  if (!resultMap.has(r.index) || !resultMap.get(r.index)?.dto) {
                    resultMap.set(r.index, r);
                  }
                });
                return Array.from(resultMap.values());
              })
            );
          }),
          map(allResults => {
            const mergedMap = new Map<number, BatteryString>();

            allResults.forEach(({index, dto}) => {
              if (validIndicesSet && !validIndicesSet.has(index)) {
                return;
              }

              const existing = existingByIndex.get(index);
              if (dto && this.hasStringDetail(dto)) {
                const baseId = `str${index}`;
                const mapped = this.mapLatestValueDtoToBatteryString(dto, baseId, index, existing);
                mergedMap.set(index, mapped);
              } else if (existing && !forceScanAll) {
                mergedMap.set(index, existing);
              }
            });

            if (!forceScanAll) {
              existingByIndex.forEach((value, index) => {
                if (!mergedMap.has(index)) {
                  mergedMap.set(index, value);
                }
              });
            }

            const mergedStrings = Array.from(mergedMap.values()).sort((a, b) => a.stringIndex - b.stringIndex);

            this.stringsState = mergedStrings;
            this.saveStringsToStorage();
            this.isLoadingFromApi = false;
            this.stringsLoadedSubject.next(true);

            return mergedStrings;
          })
        );
      }),
      catchError(err => {
        console.error('Error in loadStringsFromApi (latest-value mode):', err);
        this.isLoadingFromApi = false;
        this.stringsLoadedSubject.next(true);
        return of([]);
      })
    ).subscribe();
  }

  private getStringIndicesFromOpenMUC(): Observable<number[]> {
    return this.http.get<{ devices: string[] }>(`${this.BASE_URL}/devices`).pipe(
      map(response => {
        const indices: number[] = [];
        const pattern = /^str(\d+)_(modbus|virtual)$/;
        response.devices?.forEach(deviceId => {
          const match = deviceId.match(pattern);
          if (match) {
            const index = parseInt(match[1], 10);
            if (!isNaN(index) && !indices.includes(index)) {
              indices.push(index);
            }
          }
        });
        return indices.sort((a, b) => a - b);
      }),
      catchError(err => {
        console.warn('[Strings] Failed to get devices from OpenMUC:', err);
        return of([]);
      })
    );
  }

  private fetchStringDetailFromOpenMUC(stringIndex: number): Observable<LatestStringDetailDto | null> {
    const channels = [
      `str${stringIndex}_string_name`,
      `str${stringIndex}_cell_qty`,
      `str${stringIndex}_cell_brand`,
      `str${stringIndex}_cell_model`,
      `str${stringIndex}_Cnominal`,
      `str${stringIndex}_Vnominal`,
    ];

    const requests = channels.map(channel => {
      return this.http.get<any>(`${this.BASE_URL}/channels/${channel}`).pipe(
        map(response => {
          const value = response?.record?.value;
          return {channel, value};
        }),
        catchError(() => of({channel, value: null}))
      );
    });

    return forkJoin(requests).pipe(
      map(results => {
        const dto: LatestStringDetailDto = {};
        results.forEach(({channel, value}) => {
          if (value !== null && value !== undefined) {
            if (channel.includes('string_name')) {
              dto.stringName = String(value);
            } else if (channel.includes('cell_qty')) {
              dto.cellQty = Number(value);
            } else if (channel.includes('cell_brand')) {
              dto.cellBrand = String(value);
            } else if (channel.includes('cell_model')) {
              dto.cellModel = String(value);
            } else if (channel.includes('Cnominal')) {
              dto.cnominal = Number(value);
            } else if (channel.includes('Vnominal')) {
              dto.vnominal = Number(value);
            }
          }
        });
        return this.hasStringDetail(dto) ? dto : null;
      }),
      catchError(() => of(null))
    );
  }

  // === CRUD FUNCTIONS ===

  getStrings(): Observable<BatteryString[]> {
    return this.stringsLoadedSubject.pipe(
      filter(loaded => loaded),
      map(() => [...this.stringsState]),
      take(1)
    );
  }

  reloadStrings(): Observable<BatteryString[]> {
    this.stringsLoadedSubject.next(false);
    this.isLoadingFromApi = false;
    this.loadStringsFromApi(true);

    return this.stringsLoadedSubject.pipe(
      filter(loaded => loaded),
      map(() => [...this.stringsState]),
      take(1)
    );
  }

  getStringById(id: string): Observable<BatteryString | undefined> {
    const string = this.stringsState.find((s) => s.id === id);
    return of(string);
  }

  deleteString(id: string): Observable<any> {
    const stringConfig = this.stringsState.find(s => s.id === id);
    if (!stringConfig) {
      return throwError(() => new Error('String Config not found'));
    }

    const s = stringConfig.stringIndex;

    // 1. Xóa trên OpenMUC (Modbus & Virtual)
    const deleteModbus$ = this.apiDelete(`/devices_v2/str${s}_modbus`);
    const deleteVirtual$ = this.apiDelete(`/devices_v2/str${s}_virtual`);

    return forkJoin([deleteModbus$, deleteVirtual$]).pipe(
      // 2. Xóa trên Database (Latest Value)
      switchMap(() => {
        const deleteLatestValueUrl = `${this.latestValueApiUrl}/delete-string?stringId=${s}`;
        return this.http.post<LatestValueResponse<null>>(
          deleteLatestValueUrl,
          null
        ).pipe(
          map(() => ({success: true})),
          catchError(err => {
            // Nếu DB báo không tìm thấy thì coi như đã xóa thành công
            if (err instanceof HttpErrorResponse && err.status === 400) {
              return of({success: true});
            }
            console.warn(`[Strings] Failed to delete metadata for str${s}`, err);
            return of({success: false, error: err});
          })
        );
      }),
      // 3. CẬP NHẬT STATE FRONTEND (QUAN TRỌNG)
      tap(() => {
        // Xóa khỏi mảng local
        this.stringsState = this.stringsState.filter(item => item.id !== id);
        // Cập nhật lại LocalStorage ngay lập tức để F5 không bị hiện lại
        this.saveStringsToStorage();

        // Bắn event để các component khác biết là dữ liệu đã thay đổi
        this.stringsLoadedSubject.next(true);
      }),
      // 4. SỬA LỖI Ở ĐÂY: KHÔNG gọi loadStringsFromApi() ngay lập tức nữa
      // Vì OpenMUC cần thời gian để dọn dẹp. Nếu gọi ngay nó sẽ tìm thấy lại string cũ.
      switchMap(() => {
        // Chỉ trả về null để kết thúc chuỗi Observable
        return of(null);
      })
    );
  }

  addString(
    formData: StringFormData,
    portConfig: SerialPortConfig
  ): Observable<any> {
    return this.getStrings().pipe(
      switchMap(strings => {
        this.stringsState = strings;

        const maxIndex = this.stringsState.reduce((max, s) => Math.max(max, s.stringIndex), 0);
        const newStringIndex = maxIndex + 1;

        const newStringConfig: BatteryString = {
          ...formData,
          id: uuidv4(),
          stringIndex: newStringIndex,
        };

        return this.checkDeviceExists(newStringIndex).pipe(
          switchMap(exists => {
            if (exists) {
              return throwError(() => new Error(`String ${newStringIndex} already exists on OpenMUC. Please reload the page.`));
            }

            return this.createStringApi(newStringIndex, formData, portConfig).pipe(
              tap(() => {
                this.stringsState.push(newStringConfig);
                this.saveStringsToStorage();
                this.stringsLoadedSubject.next(true);
              }),
              switchMap(() => {
                return timer(2000).pipe(
                  switchMap(() => this.fetchStringDetailFromLatestValue(newStringIndex).pipe(
                    map(dto => {
                      if (dto && this.hasStringDetail(dto)) {
                        return this.mapLatestValueDtoToBatteryString(
                          dto,
                          `str${newStringIndex}`,
                          newStringIndex,
                          newStringConfig
                        );
                      }
                      return newStringConfig;
                    }),
                    catchError(() => of(newStringConfig))
                  ))
                );
              }),
              tap((enrichedConfig) => {
                const index = this.stringsState.findIndex(s => s.id === newStringConfig.id);
                if (index >= 0) {
                  this.stringsState[index] = enrichedConfig;
                  this.saveStringsToStorage();
                }
              }),
              map(() => newStringConfig)
            );
          })
        );
      })
    );
  }

  private checkDeviceExists(stringIndex: number): Observable<boolean> {
    const checkModbus$ = this.http.get(`${this.BASE_URL}/devices_v2/str${stringIndex}_modbus`).pipe(
      map(() => true),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return of(false);
        }
        return of(false);
      })
    );

    const checkVirtual$ = this.http.get(`${this.BASE_URL}/devices_v2/str${stringIndex}_virtual`).pipe(
      map(() => true),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return of(false);
        }
        return of(false);
      })
    );

    return forkJoin([checkModbus$, checkVirtual$]).pipe(
      map(([modbusExists, virtualExists]) => modbusExists || virtualExists)
    );
  }

  updateString(
    stringId: string,
    formData: StringFormData,
    portConfig: SerialPortConfig
  ): Observable<any> {
    const stringConfig = this.stringsState.find(s => s.id === stringId);
    if (!stringConfig) {
      return throwError(() => new Error('String Config not found'));
    }

    const s = stringConfig.stringIndex;

    const deleteModbus$ = this.apiDelete(`/devices_v2/str${s}_modbus`);
    const deleteVirtual$ = this.apiDelete(`/devices_v2/str${s}_virtual`);

    return forkJoin([deleteModbus$, deleteVirtual$]).pipe(
      switchMap(() => {
        return this.createStringApi(s, formData, portConfig);
      }),
      tap(() => {
        const updatedConfig = {...stringConfig, ...formData};
        this.stringsState = this.stringsState.map(str =>
          str.id === stringId ? updatedConfig : str
        );
        this.saveStringsToStorage();
      })
    );
  }

  private createStringApi(
    s: number,
    formData: StringFormData,
    portConfig: SerialPortConfig
  ): Observable<any> {
    const modbusPayload = this.buildModbusPayload(s, formData.cellQty, portConfig);
    const virtualPayload = this.buildVirtualPayload(s, formData.cellQty);

    const postModbus$ = this.apiPost(`/devices_v2/str${s}_modbus`, modbusPayload);
    const postVirtual$ = this.apiPost(`/devices_v2/str${s}_virtual`, virtualPayload);

    return forkJoin([postModbus$, postVirtual$]).pipe(
      switchMap(() => {
        return timer(2000);
      }),
      switchMap(() => {
        const putCalls = [
          this.apiPutChannel(`str${s}_string_name`, formData.stringName),
          this.apiPutChannel(`str${s}_cell_qty`, formData.cellQty),
          this.apiPutChannel(`str${s}_cell_brand`, formData.cellBrand),
          this.apiPutChannel(`str${s}_cell_model`, formData.cellModel),
          this.apiPutChannel(`str${s}_Cnominal`, formData.ratedCapacity),
          this.apiPutChannel(`str${s}_Vnominal`, formData.nominalVoltage),
        ];
        return forkJoin(putCalls);
      })
    );
  }

  // ==============================================================================
  // 1. PHẦN MODBUS
  // ==============================================================================
  private buildModbusPayload(
    s: number,
    cells: number,
    portConfig: SerialPortConfig
  ): any {
    const settings = this.buildModbusSettings(portConfig);
    const channels = [];
    const STRING_REGISTER_OFFSET = 10000;

    const offsetFor = (slave: number, stepMs: number = 50): number => {
      return ((slave - 1) % 20) * stepMs;
    };

    for (let c = 1; c <= cells; c++) {
      const base = `str${s}_cell${c}`;
      const sg = `str${s}_sg_slave_${c}`;
      const off = offsetFor(c);

      // CẤU HÌNH CELL DETAIL (R, V, T) -> TUYỆT ĐỐI KHÔNG LOG
      // Không khai báo loggingInterval/loggingSettings ở đây
      const cellProps = {
        samplingInterval: 8000, // Chỉ đọc 8s để hiển thị
        samplingGroup: sg,
        samplingTimeOffset: off,
        disabled: false,
      };

      // R channel
      channels.push({
        id: `${base}_R`,
        description: `Cell (R) (${base})`,
        channelAddress: `${c}:HOLDING_REGISTERS:0:INT16`,
        valueType: 'INTEGER',
        serverMappings: [
          {
            id: 'modbus',
            serverAddress: `HOLDING_REGISTERS:${1000 + (s - 1) * STRING_REGISTER_OFFSET + c * 2}:INTEGER`,
          }
        ],
        ...cellProps
      });

      // V channel
      channels.push({
        id: `${base}_V`,
        description: `Cell (V) (${base})`,
        channelAddress: `${c}:HOLDING_REGISTERS:1:INT16`,
        valueType: 'INTEGER',
        serverMappings: [
          {
            id: 'modbus',
            serverAddress: `HOLDING_REGISTERS:${1300 + (s - 1) * STRING_REGISTER_OFFSET + c * 2}:INTEGER`,
          }
        ],
        ...cellProps
      });

      // T channel
      channels.push({
        id: `${base}_T`,
        description: `Cell (T) (${base})`,
        channelAddress: `${c}:HOLDING_REGISTERS:2:INT16`,
        valueType: 'INTEGER',
        serverMappings: [
          {
            id: 'modbus',
            serverAddress: `HOLDING_REGISTERS:${1600 + (s - 1) * STRING_REGISTER_OFFSET + c * 2}:INTEGER`,
          }
        ],
        ...cellProps
      });
    }

    // Total Current - CÓ LOG 8s
    channels.push({
      id: `str${s}_total_I`,
      description: `String ${s} (I)`,
      channelAddress: '206:HOLDING_REGISTERS:0:INT16',
      valueType: 'INTEGER',
      serverMappings: [
        {
          id: 'modbus',
          serverAddress: `HOLDING_REGISTERS:${1900 + (s - 1) * STRING_REGISTER_OFFSET + s}:INTEGER`,
        }
      ],
      samplingInterval: 8000,
      loggingInterval: 8000, // <--- GIỮ
      loggingSettings: 'sqllogger:',
      samplingGroup: `str${s}_sg_pack`,
      samplingTimeOffset: offsetFor(206),
      disabled: false,
    });

    // Ambient Temperature - CÓ LOG 8s
    channels.push({
      id: `str${s}_ambient_T`,
      description: `String ${s} (T ambient)`,
      channelAddress: '1:HOLDING_REGISTERS:2:INT16',
      valueType: 'INTEGER',
      serverMappings: [
        {
          id: 'modbus',
          serverAddress: `HOLDING_REGISTERS:${2100 + (s - 1) * STRING_REGISTER_OFFSET + s}:INTEGER`,
        }
      ],
      samplingInterval: 8000,
      loggingInterval: 8000, // <--- GIỮ
      loggingSettings: 'sqllogger:',
      samplingTimeOffset: offsetFor(106),
      disabled: false,
    });

    return {
      driver: 'modbus',
      configs: {
        id: `str${s}_modbus`,
        description: `String ${s} Modbus RTU`,
        deviceAddress: portConfig.port,
        settings: settings,
        samplingTimeout: 15000,
        connectRetryInterval: 15000,
        disabled: false,
      },
      channels: channels,
    };
  }

  // ==============================================================================
  // 2. PHẦN VIRTUAL
  // ==============================================================================
  private buildVirtualPayload(s: number, cells: number): any {
    const channels: any[] = [];

    const pushOverview = (id: string, valueType: string, description: string, unit?: string, valueTypeLength?: number) => {
      const item: any = {
        id: id,
        description: description,
        valueType: valueType,
        disabled: false,
      };
      if (unit) item.unit = unit;
      if (valueType.toUpperCase() === 'STRING') item.valueTypeLength = valueTypeLength || 64;
      channels.push(item);
    };

    // Helper cho STATS
    const pushStats = (id: string, valueType: string, description: string, unit?: string) => {
      const item: any = {
        id: id,
        description: description,
        valueType: valueType,
        disabled: false,
      };
      if (unit) item.unit = unit;

      const upperId = id.toUpperCase();

      // 1. String SOC/SOH -> Log 1 phút (60000)
      if (upperId.includes('STRING_SOC') || upperId.includes('STRING_SOH')) {
        item.loggingInterval = 60000;
        item.loggingSettings = 'sqllogger:';
      }
      // 2. Cell SOC/SOH (nhưng không phải String) -> KHÔNG LOG
      else if (upperId.includes('_SOC') || upperId.includes('_SOH')) {
        // Do nothing = No log
      }
      // 3. Các Stats còn lại (Max/Min/Avg) -> KHÔNG LOG
      else {
        // Trước đây để 600000, giờ xóa đi để TẮT LOG theo yêu cầu mới nhất của bạn
        // Nếu bạn muốn bật lại log 10p cho các biến này thì uncomment 2 dòng dưới:
        // item.loggingInterval = 600000;
        // item.loggingSettings = 'sqllogger:';
      }

      channels.push(item);
    };

    // Helper đặc biệt cho Cell SOC/SOH (đảm bảo không log)
    const pushCellSocSoh = (id: string, valueType: string, description: string, unit?: string) => {
      const item: any = {
        id: id,
        description: description,
        valueType: valueType,
        disabled: false,
        // No loggingInterval
      };
      if (unit) item.unit = unit;
      channels.push(item);
    };

    // Overview channels (no logging)
    pushOverview(`str${s}_cell_qty`, 'INTEGER', 'number of cells');
    pushOverview(`str${s}_Cnominal`, 'DOUBLE', 'C nominal', 'Ah');
    pushOverview(`str${s}_string_name`, 'STRING', 'String name', undefined, 64);
    pushOverview(`str${s}_cell_brand`, 'STRING', 'Cell Brand', undefined, 64);
    pushOverview(`str${s}_cell_model`, 'STRING', 'Cell Model', undefined, 64);
    pushOverview(`str${s}_Vnominal`, 'DOUBLE', 'V nominal', 'V');

    // String stats channels
    const stats: Array<[string, string, string, string | undefined]> = [
      [`str${s}_string_vol`, 'DOUBLE', 'String Voltage', 'V'],
      [`str${s}_max_voltage_cell_id`, 'INTEGER', 'Max V Cell ID', undefined],
      [`str${s}_min_voltage_cell_id`, 'INTEGER', 'Min V Cell ID', undefined],
      [`str${s}_max_temp_cell_id`, 'INTEGER', 'Max T Cell ID', undefined],
      [`str${s}_min_temp_cell_id`, 'INTEGER', 'Min T Cell ID', undefined],
      [`str${s}_max_rst_cell_id`, 'INTEGER', 'Max R Cell ID', undefined],
      [`str${s}_min_rst_cell_id`, 'INTEGER', 'Min R Cell ID', undefined],
      [`str${s}_average_vol`, 'DOUBLE', 'Average Cell Voltage', 'V'],
      [`str${s}_average_temp`, 'DOUBLE', 'Average Cell Temperature', 'C'],
      [`str${s}_average_rst`, 'DOUBLE', 'Average Cell R', 'miliOhm'],
      [`str${s}_max_voltage_value`, 'DOUBLE', 'Max Cell Voltage', 'V'],
      [`str${s}_min_voltage_value`, 'DOUBLE', 'Min Cell Voltage', 'V'],
      [`str${s}_max_temp_value`, 'DOUBLE', 'Max Cell Temperature', 'C'],
      [`str${s}_min_temp_value`, 'DOUBLE', 'Min Cell Temperature', 'C'],
      [`str${s}_max_rst_value`, 'DOUBLE', 'Max Cell Internal Resistance', 'miliOhm'],
      [`str${s}_min_rst_value`, 'DOUBLE', 'Min Cell Internal Resistance', 'miliOhm'],
      [`str${s}_string_SOC`, 'DOUBLE', 'String SoC', '%'], // -> Log 60s
      [`str${s}_string_SOH`, 'DOUBLE', 'String SoH', '%'], // -> Log 60s
    ];

    for (const [id, valueType, description, unit] of stats) {
      pushStats(id, valueType, description, unit);
    }

    // Per-cell SOC/SOH channels (No log)
    for (let c = 1; c <= cells; c++) {
      const base = `str${s}_cell${c}`;
      pushCellSocSoh(`${base}_SOC`, 'DOUBLE', 'State of Charge', '%');
      pushCellSocSoh(`${base}_SOH`, 'DOUBLE', 'State of Health', '%');
    }

    return {
      driver: 'virtual',
      configs: {
        id: `str${s}_virtual`,
        description: `String ${s} calculated channels`,
        disabled: false,
      },
      channels: channels,
    };
  }

  private buildModbusSettings(portConfig: SerialPortConfig): string {
    const stopBits = portConfig.stopBits.toString().replace('.', '_');
    return `RTU:SERIAL_ENCODING_RTU:${portConfig.baudRate}:DATABITS_${portConfig.dataBits}:${portConfig.parity}:STOPBITS_${stopBits}:ECHO_FALSE:FLOWCONTROL_NONE:FLOWCONTROL_NONE`;
  }

  private apiPost(path: string, payload: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}${path}`, payload).pipe(
      catchError(this.handleError)
    );
  }

  private apiDelete(path: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}${path}`).pipe(
      catchError(err => (err.status === 404 ? of(null) : this.handleError(err)))
    );
  }

  private apiPutChannel(channelId: string, value: string | number | boolean): Observable<any> {
    const path = `/channels/${channelId}`;
    const payload = {
      record: {
        flag: 'VALID',
        value: value,
      },
    };
    return this.http.put(`${this.BASE_URL}${path}`, payload).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      errorMessage = `Server Error (Code: ${error.status}): ${error.message}`;
      if (error.error && typeof error.error === 'string') {
        errorMessage += ` - ${error.error}`;
      } else if (error.error && error.error.detail) {
        errorMessage += ` - ${error.error.detail}`;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
