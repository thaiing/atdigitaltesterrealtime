// src/app/auth.interceptor.ts
import {Injectable} from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpHandlerFn,
} from '@angular/common/http';
import {Observable} from 'rxjs';

// Đây là URL backend của bạn
const BACKEND_URL = 'http://localhost:8888';

// "admin:admin" được mã hóa Base64
const BASIC_AUTH = 'Basic YWRtaW46YWRtaW4=';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Chỉ thêm header nếu request này đi đến backend của bạn
    if (req.url.startsWith(BACKEND_URL)) {
      // Clone request và thêm header Authorization
      const authReq = req.clone({
        setHeaders: {
          Authorization: BASIC_AUTH,
        },
      });
      return next.handle(authReq);
    }
    // Nếu không phải request đến backend, cứ để nó đi bình thường
    return next.handle(req);
  }
}

// --- Cần thêm cả hàm Interceptor chức năng cho Angular 17+ ---
export const authInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  if (req.url.startsWith(BACKEND_URL)) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: BASIC_AUTH,
      },
    });
    return next(authReq);
  }
  return next(req);
};
