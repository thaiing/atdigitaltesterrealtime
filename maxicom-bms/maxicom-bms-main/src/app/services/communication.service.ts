// src/app/services/communication.service.ts
import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {
  Observable,
  of,
  throwError,
  BehaviorSubject,
  forkJoin,
  combineLatest,
  firstValueFrom, // Import
  filter, // Import
  take, // Import
} from 'rxjs';
import {catchError, map, tap, switchMap} from 'rxjs/operators';
// ... (other interface imports) ...
import {
  SerialPortConfig,
  BAUD_RATES,
  DATA_BITS,
  STOP_BITS,
  PARITIES,
  NetworkConfig,
  SerialFormData,
  SerialPortDefinition,
  BaudRate,
  DataBits,
  Parity,
  StopBits,
} from '../interfaces/communication.interface';
import {ConfigService} from './config.service';
import {LatestValueResponse} from '../interfaces/latest-value.interface';


@Injectable({
  providedIn: 'root',
})
export class CommunicationService {
  private readonly BASE_URL = '/api';
  private readonly latestValueApiUrl = '/api/latest-value';

  private readonly NETWORK_API = '/api/network';

  public readonly BAUD_RATES = BAUD_RATES;
  public readonly DATA_BITS = DATA_BITS;
  public readonly STOP_BITS = STOP_BITS;
  public readonly PARITIES = PARITIES;

  private allPortDefinitions: SerialPortDefinition[] = [];

  private configuredPortsSubject = new BehaviorSubject<SerialPortConfig[]>([]);
  private isLoadingPorts = new BehaviorSubject<boolean>(true);

  private readonly CACHE_KEY = 'maxicom-serial-ports-cache';

  // Cache last known port configs to use as fallback
  private lastKnownPorts: SerialPortConfig[] = [];


  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.allPortDefinitions = this.configService.serialPorts;
    // Load cache from localStorage first and emit immediately
    this.loadCacheFromStorage();
    if (this.lastKnownPorts.length > 0) {
      console.log('[Serial] Emitting cached ports immediately');
      this.configuredPortsSubject.next(this.lastKnownPorts);
    }
    // Then load from API to update
    this.loadInitialPorts();
  }

  /**
   * Load cached ports from localStorage
   */
  private loadCacheFromStorage(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        this.lastKnownPorts = JSON.parse(cached);
        console.log(`[Serial] Loaded ${this.lastKnownPorts.length} ports from cache`);
      }
    } catch (e) {
      console.error('[Serial] Error loading cache from localStorage:', e);
      this.lastKnownPorts = [];
    }
  }

  /**
   * Save ports to localStorage cache
   */
  private saveCacheToStorage(ports: SerialPortConfig[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(ports));
      console.log(`[Serial] Saved ${ports.length} ports to cache`);
    } catch (e) {
      console.error('[Serial] Error saving cache to localStorage:', e);
    }
  }

  private loadInitialPorts(): void {
    console.log('[Serial] Starting to load initial ports from backend...');

    if (this.allPortDefinitions.length === 0) {
      console.warn('[Serial] No port definitions found in config');
      this.isLoadingPorts.next(false);
      this.configuredPortsSubject.next([]);
      return;
    }

    console.log(`[Serial] Found ${this.allPortDefinitions.length} port definitions:`,
      this.allPortDefinitions.map(d => `${d.alias} (${d.channel})`));

    this.loadPortsFromLatestValue().pipe(
      switchMap((latestPorts) => {
        if (latestPorts.length > 0) {
          console.log('[Serial] Loaded serial ports from latest-value service');
          return of(latestPorts);
        }
        console.log('[Serial] Latest-value service returned no data, falling back to OpenMUC channels...');
        return this.fetchPortsFromChannels();
      }),
      catchError((err) => {
        console.error('[Serial] Error loading serial ports from backend:', err);
        return of<SerialPortConfig[]>([]);
      })
    ).subscribe((ports) => {
      this.handlePortsLoaded(ports);
    });
  }

  private loadPortsFromLatestValue(): Observable<SerialPortConfig[]> {
    return this.http.get<LatestValueResponse<Record<string, string | null>>>(`${this.latestValueApiUrl}/dev`).pipe(
      map((response) => {
        if (!response?.success || !response.data) {
          return {} as Record<string, string | null>;
        }
        return response.data;
      }),
      map((devValues) => {
        const configs = this.allPortDefinitions.map(def => {
          const settings = devValues[def.channel];
          if (typeof settings !== 'string' || settings.trim() === '') {
            return null;
          }
          return this.parsePortConfig(def, settings);
        }).filter((cfg): cfg is SerialPortConfig => cfg !== null);
        return configs;
      }),
      catchError((err) => {
        console.warn('[Serial] Latest-value dev endpoint failed, using fallback.', err);
        return of<SerialPortConfig[]>([]);
      })
    );
  }

  private fetchPortsFromChannels(): Observable<SerialPortConfig[]> {
    const fetchCalls: Observable<SerialPortConfig | null>[] =
      this.allPortDefinitions.map((def) => {
        return this.apiGetSerialChannel(def.channel).pipe(
          map((response) => {
            console.log(`[Serial] API response for ${def.alias} (${def.channel}):`, response);
            if (!response) {
              console.warn(`[Serial] Empty response for ${def.alias}`);
              return null;
            }

            const settings = response?.record?.value;
            if (settings && typeof settings === 'string' && settings.trim() !== '') {
              const parsed = this.parsePortConfig(def, settings);
              if (parsed) {
                console.log(`[Serial] ✓ Successfully loaded ${def.alias} (${parsed.port})`);
              } else {
                console.warn(`[Serial] ✗ Failed to parse ${def.alias}. Settings:`, settings);
              }
              return parsed;
            }

            console.log(`[Serial] No settings found for ${def.alias} (empty or invalid). Response:`, response);
            return null;
          }),
          catchError((err) => {
            console.error(`[Serial] Error fetching channel ${def.channel} for ${def.alias}:`, err);
            return of(null);
          })
        );
      });

    return forkJoin(fetchCalls).pipe(
      map(results => results.filter((p): p is SerialPortConfig => p !== null))
    );
  }

  private handlePortsLoaded(configuredList: SerialPortConfig[]): void {
    if (configuredList.length === 0) {
      console.warn('[Serial] No ports loaded from backend. Falling back to cache if available.');
      if (this.lastKnownPorts.length > 0) {
        console.log('[Serial] Using cached port data');
        this.configuredPortsSubject.next(this.lastKnownPorts);
      } else {
        this.configuredPortsSubject.next([]);
        this.saveCacheToStorage([]); // Clear cache
      }
      this.isLoadingPorts.next(false);
      return;
    }

    console.log(`[Serial] Loaded ${configuredList.length}/${this.allPortDefinitions.length} ports from backend:`,
      configuredList.map(p => `${p.alias} (${p.port})`));

    if (configuredList.length < this.allPortDefinitions.length && this.lastKnownPorts.length > 0) {
      console.log('[Serial] Some ports missing from backend, merging with cached data...');
      const mergedList: SerialPortConfig[] = [];
      this.allPortDefinitions.forEach(def => {
        const fromApi = configuredList.find(p => p.id === def.id);
        if (fromApi) {
          mergedList.push(fromApi);
        } else {
          const fromCache = this.lastKnownPorts.find(p => p.id === def.id);
          if (fromCache) {
            console.log(`[Serial] Using cached data for ${def.alias}`);
            mergedList.push(fromCache);
          }
        }
      });

      if (mergedList.length > configuredList.length) {
        console.log(`[Serial] Using ${mergedList.length} ports (${configuredList.length} from API + ${mergedList.length - configuredList.length} from cache)`);
        this.emitPorts(mergedList);
      } else {
        this.emitPorts(configuredList);
      }
    } else {
      this.emitPorts(configuredList);
    }

    this.isLoadingPorts.next(false);
  }

  private emitPorts(list: SerialPortConfig[]): void {
    this.configuredPortsSubject.next(list);
    this.lastKnownPorts = list;
    this.saveCacheToStorage(list);
  }

  private parsePortConfig(
    def: SerialPortDefinition,
    settings: string
  ): SerialPortConfig | null {
    if (!settings || typeof settings !== 'string' || settings.trim() === '') {
      console.log(`[Serial] Empty settings for ${def.alias} (${def.channel})`);
      return null;
    }

    try {
      // Extract device path from the beginning of the string
      // Format: "/dev/ttyV0:RTU:SERIAL_ENCODING_RTU:9600:DATABITS_8:PARITY_NONE:STOPBITS_1:..."
      const devicePathMatch = settings.match(/^([^:]+):/);
      // Use device path from settings if available, otherwise fallback to config
      const devicePath = devicePathMatch ? devicePathMatch[1] : def.devicePath;

      if (!devicePathMatch) {
        console.warn(`[Serial] Could not extract device path from settings, using config default: ${def.devicePath}`);
      }

      // Extract baudRate, dataBits, parity, stopBits
      const regex = /:(\d+):DATABITS_(\d):([A-Z_]+):STOPBITS_([\d_]+):/;
      const matches = settings.match(regex);

      if (!matches || matches.length < 5) {
        console.warn(`[Serial] Could not parse settings for ${def.alias}. Settings:`, settings);
        return null;
      }

      const baudRate = parseInt(matches[1], 10);
      const dataBits = parseInt(matches[2], 10);
      const parity = matches[3] as Parity;
      const stopBitsStr = matches[4].replace('_', '.'); // Convert "1_5" to "1.5"
      const stopBits = parseFloat(stopBitsStr);

      // Validate parsed values
      if (isNaN(baudRate) || isNaN(dataBits) || isNaN(stopBits)) {
        console.error(`[Serial] Invalid numeric values for ${def.alias}:`, {
          baudRate, dataBits, stopBits
        });
        return null;
      }

      const parsedConfig: SerialPortConfig = {
        id: def.id,
        alias: def.alias,
        port: devicePath, // Use device path from settings string, not from config
        channel: def.channel,
        baudRate: baudRate as BaudRate,
        dataBits: dataBits as DataBits,
        parity: parity as Parity,
        stopBits: stopBits as StopBits,
      };

      console.log(`[Serial] Successfully parsed ${def.alias}:`, parsedConfig);
      return parsedConfig;
    } catch (e) {
      console.error(`[Serial] Error parsing settings for ${def.alias}:`, e, 'Settings:', settings);
      return null;
    }
  }

  /**
   * Return the port list WHEN IT HAS FINISHED LOADING.
   * Used for forkJoin (as in Dashboard)
   */
  getSerialPortsConfig(): Observable<SerialPortConfig[]> {
    // If already loaded, return immediately
    if (!this.isLoadingPorts.value) {
      return of(this.configuredPortsSubject.value);
    }

    // Otherwise, wait for loading to finish by combining with isLoadingPorts
    return combineLatest([
      this.configuredPortsSubject,
      this.isLoadingPorts
    ]).pipe(
      filter(([ports, isLoading]) => !isLoading), // Wait until loading is false
      map(([ports]) => ports),
      take(1) // Get 1 value then complete
    );
  }

  /**
   * Return a continuous Observable (for SerialComponent)
   */
  getSerialPortsStream(): Observable<SerialPortConfig[]> {
    return this.configuredPortsSubject.asObservable();
  }

  // ===================

  getPortsLoadingStatus(): Observable<boolean> {
    return this.isLoadingPorts.asObservable();
  }

  /**
   * Get all port definitions (for form dropdown)
   */
  getAllPortDefinitions(): SerialPortDefinition[] {
    return [...this.allPortDefinitions];
  }

  addSerialPort(formData: SerialFormData & { portId?: string }): Observable<SerialPortConfig> {
    // Use portId from form if provided, otherwise find first available
    let selectedPortDef: SerialPortDefinition | undefined;

    if (formData.portId) {
      // Use the port selected from dropdown
      selectedPortDef = this.allPortDefinitions.find(def => def.id === formData.portId);
      if (!selectedPortDef) {
        return throwError(() => new HttpErrorResponse({
          status: 400,
          error: {message: 'Selected port not found'}
        }));
      }

      // Check if already configured by checking backend directly (avoid stale cache)
      return this.apiGetSerialChannel(selectedPortDef.channel).pipe(
        switchMap((response) => {
          const settings = response?.record?.value;
          if (settings && typeof settings === 'string' && settings.trim() !== '') {
            // Port is already configured on backend
            return throwError(() => new HttpErrorResponse({
              status: 409,
              error: {message: 'This port is already configured'}
            }));
          }

          // Port is available, proceed with adding
          return this.doAddSerialPort(selectedPortDef!, formData);
        }),
        catchError((err) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            return throwError(() => err);
          }
          // If channel doesn't exist or other error, still try to add
          return this.doAddSerialPort(selectedPortDef!, formData);
        })
      );
    } else {
      // Fallback: find first available port (backward compatibility)
      // Check backend for each port to find first available
      const checkPorts$ = this.allPortDefinitions.map(def =>
        this.apiGetSerialChannel(def.channel).pipe(
          map(response => {
            const settings = response?.record?.value;
            return settings && typeof settings === 'string' && settings.trim() !== '' ? null : def;
          }),
          catchError(() => of(def)) // If error, assume port is available
        )
      );

      return forkJoin(checkPorts$).pipe(
        switchMap((results) => {
          selectedPortDef = results.find(def => def !== null) || undefined;
          if (!selectedPortDef) {
            return throwError(() => new HttpErrorResponse({
              status: 400,
              error: {message: 'The maximum limit of 3 ports has been reached'}
            }));
          }
          return this.doAddSerialPort(selectedPortDef, formData);
        })
      );
    }
  }

  private doAddSerialPort(selectedPortDef: SerialPortDefinition, formData: SerialFormData): Observable<SerialPortConfig> {

    const newPort: SerialPortConfig = {
      ...formData,
      id: selectedPortDef.id,
      alias: selectedPortDef.alias,
      port: selectedPortDef.devicePath, // Use device path from config
      channel: selectedPortDef.channel,
    };
    console.log(`[Serial] Adding new port ${newPort.alias}:`, newPort);
    return this.apiPutSerialChannel(newPort.channel, newPort).pipe(
      map(() => {
        const currentPorts = [...this.configuredPortsSubject.value];
        currentPorts.push(newPort);
        currentPorts.sort((a, b) => a.alias.localeCompare(b.alias));
        this.configuredPortsSubject.next(currentPorts);
        this.lastKnownPorts = currentPorts; // Update cache
        this.saveCacheToStorage(currentPorts); // Save to localStorage
        console.log(`[Serial] ✓ Successfully added ${newPort.alias}`);
        return newPort;
      }),
      catchError((err) => {
        console.error(`[Serial] ✗ Error adding ${newPort.alias}:`, err);
        return throwError(() => err);
      })
    );
  }

  updateSerialPort(
    portId: string,
    formData: SerialFormData
  ): Observable<SerialPortConfig> {
    const currentPorts = [...this.configuredPortsSubject.value];
    const index = currentPorts.findIndex((p) => p.id === portId);
    if (index === -1) {
      return throwError(() => new Error('Port not found'));
    }
    // Preserve port.port (device path) from existing config, don't let formData override it
    const updatedPort: SerialPortConfig = {
      ...currentPorts[index],
      ...formData,
      port: currentPorts[index].port, // Keep existing device path
      id: currentPorts[index].id, // Keep ID
      alias: currentPorts[index].alias, // Keep alias
      channel: currentPorts[index].channel, // Keep channel
    };
    console.log(`[Serial] Updating port ${updatedPort.alias}:`, updatedPort);
    return this.apiPutSerialChannel(updatedPort.channel, updatedPort).pipe(
      map(() => {
        currentPorts[index] = updatedPort;
        this.configuredPortsSubject.next(currentPorts);
        this.lastKnownPorts = currentPorts; // Update cache
        this.saveCacheToStorage(currentPorts); // Save to localStorage
        console.log(`[Serial] ✓ Successfully updated ${updatedPort.alias}`);
        return updatedPort;
      }),
      catchError((err) => {
        console.error(`[Serial] ✗ Error updating ${updatedPort.alias}:`, err);
        return throwError(() => err);
      })
    );
  }

  deleteSerialPort(portId: string): Observable<void> {
    const portToDelete = this.configuredPortsSubject.value.find(
      (p) => p.id === portId
    );
    if (!portToDelete) {
      return throwError(() => new Error('Port not found'));
    }
    return this.apiPutSerialChannel(portToDelete.channel, null).pipe(
      map(() => {
        const newPortsList = this.configuredPortsSubject.value.filter(
          (p) => p.id !== portId
        );
        this.configuredPortsSubject.next(newPortsList);
        this.lastKnownPorts = newPortsList; // Update cache
        this.saveCacheToStorage(newPortsList); // Save to localStorage
      })
    );
  }

  // ... (buildModbusSettingsString, apiPutSerialChannel, apiGetSerialChannel,
  //      getNetworkConfigs, saveNetworkConfig remain unchanged) ...
  private buildModbusSettingsString(portConfig: SerialPortConfig): string {
    const stopBits = portConfig.stopBits.toString().replace('.', '_');
    return `${portConfig.port}:RTU:SERIAL_ENCODING_RTU:${portConfig.baudRate}:DATABITS_${portConfig.dataBits}:${portConfig.parity}:STOPBITS_${stopBits}:ECHO_FALSE:FLOWCONTROL_NONE:FLOWCONTROL_NONE`;
  }

  private apiPutSerialChannel(
    channel: string,
    portConfig: SerialPortConfig | null
  ): Observable<any> {
    let value = '';
    if (portConfig) {
      value = this.buildModbusSettingsString(portConfig);
    }
    const payload = {record: {flag: 'VALID', value: value}};
    return this.http.put(`${this.BASE_URL}/channels/${channel}`, payload).pipe(
      catchError(err => {
        console.error('Error on PUT Serial Channel:', err);
        return throwError(() => new Error('Could not save Serial Port configuration to server'));
      })
    );
  }

  private apiGetSerialChannel(channel: string): Observable<any> {
    return this.http.get<any>(`${this.BASE_URL}/channels/${channel}`);
  }

  getNetworkConfigs(): Observable<NetworkConfig[]> {
    return this.http.get<NetworkConfig[]>(this.NETWORK_API).pipe(
      catchError((err) => {
        console.error('Error getting network configs from Python API:', err);
        // Bạn có thể return mảng rỗng hoặc throw error tùy ý
        return throwError(() => err);
      })
    );
  }

  /**
   * Lưu cấu hình mạng (gọi PUT tới Python API)
   * API Endpoint: PUT /api/network/:id
   */
  saveNetworkConfig(config: NetworkConfig): Observable<NetworkConfig> {
    // Payload gửi đi tuân thủ format mà file network_api.py mong đợi
    const payload = {
      ipAddress: config.ipAddress,
      subnetMask: config.subnetMask,
      gateway: config.gateway,
      dns: config.dns,
      dhcp: config.dhcp
    };

    return this.http.put<NetworkConfig>(`${this.NETWORK_API}/${config.id}`, payload).pipe(
      map(res => {
        console.log('Network saved successfully:', res);
        return res;
      }),
      catchError((err) => {
        console.error('Error saving network config:', err);
        return throwError(() => err);
      })
    );
  }
}
