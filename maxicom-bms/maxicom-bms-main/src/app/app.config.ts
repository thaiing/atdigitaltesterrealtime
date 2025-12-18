// src/app/app.config.ts
import {ApplicationConfig, APP_INITIALIZER, importProvidersFrom} from '@angular/core';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {
  HttpClientModule,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {authInterceptorFn} from './auth.interceptor';
import {DecimalPipe} from '@angular/common';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material/core';

// Import service config mới
import {ConfigService, initializeAppFactory} from './services/config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    // Thêm ConfigService và APP_INITIALIZER
    ConfigService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppFactory,
      deps: [ConfigService],
      multi: true,
    },
    // Các providers khác
    importProvidersFrom(HttpClientModule, MatDatepickerModule, MatNativeDateModule),
    provideHttpClient(withInterceptors([authInterceptorFn])),
    DecimalPipe,
  ],
};
