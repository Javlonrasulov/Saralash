import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppRouteKey } from '../../common/constants/app-routes.js';

interface JwtPayload {
  sub: string;
  login: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  allowedRoutes?: AppRouteKey[];
  positions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'change_me_access',
    });
  }

  validate(payload: JwtPayload) {
    const allowed = Array.isArray(payload.allowedRoutes) ? payload.allowedRoutes : [];
    const positions = Array.isArray(payload.positions)
      ? payload.positions.filter((s) => typeof s === 'string').slice(0, 20)
      : [];
    return { ...payload, allowedRoutes: allowed, positions };
  }
}
