import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {tap} from 'rxjs/operators';
import {firstValueFrom} from 'rxjs';
import {SerialPortDefinition} from '../interfaces/communication.interface'; // Import

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private config: any = {};

  constructor(private http: HttpClient) {
  }

  loadConfig() {
    return firstValueFrom(
      this.http.get('/assets/config/app-config.json').pipe(
        tap((config) => {
          this.config = config;
        })
      )
    );
  }

  get siteName(): string {
    return this.config.siteName || 'Site';
  }

  // THÊM GETTER NÀY
  get serialPorts(): SerialPortDefinition[] {
    return this.config.serialPorts || [];
  }
}

// Hàm factory giữ nguyên
export function initializeAppFactory(configService: ConfigService) {
  return () => configService.loadConfig();
}
