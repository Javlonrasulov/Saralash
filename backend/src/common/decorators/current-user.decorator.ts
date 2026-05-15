import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppRouteKey } from '../constants/app-routes.js';

export interface CurrentUserPayload {
  sub: string;
  login: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  allowedRoutes: AppRouteKey[];
  positions: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as CurrentUserPayload;
  },
);
