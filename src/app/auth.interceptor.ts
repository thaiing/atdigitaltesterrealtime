import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Add auth headers if needed
  // For now, just pass through
  return next(req);
};


