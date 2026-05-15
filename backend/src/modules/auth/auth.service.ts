import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ALL_APP_ROUTES,
  type AppRouteKey,
  isAppRouteKey,
} from '../../common/constants/app-routes.js';

export interface SessionPayload {
  user: {
    id: string;
    fullName: string;
    login: string;
    role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
    allowedRoutes: AppRouteKey[];
    positions: string[];
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(identifier: string, password: string): Promise<SessionPayload> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ login: identifier.toLowerCase() }] },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Login yoki parol notoʻgʻri');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Login yoki parol notoʻgʻri');

    return this.buildSession(user);
  }

  async refresh(refreshToken: string): Promise<SessionPayload> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored || !stored.user.isActive) throw new UnauthorizedException('Sessiya yaroqsiz');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.buildSession(stored.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      fullName: user.fullName,
      login: user.login,
      role: user.role,
      allowedRoutes: this.normalizeRoutes(user.role, user.allowedRoutes),
      positions: this.normalizePositions(user.positions),
    };
  }

  /** Joriy parolni tekshiradi, login/parolni yangilaydi, barcha refresh sessiyalarni bekor qiladi va yangi juft token qaytaradi. */
  async changeCredentials(
    userId: string,
    dto: { currentPassword: string; newLogin?: string; newPassword?: string },
  ): Promise<SessionPayload> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    const pwdOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!pwdOk) throw new ForbiddenException('WRONG_CURRENT_PASSWORD');

    const nlRaw = dto.newLogin?.trim().toLowerCase();
    const npRaw = dto.newPassword?.trim();
    const wantsLoginChange = Boolean(nlRaw && nlRaw.length >= 2 && nlRaw !== user.login);
    const wantsPasswordChange = Boolean(npRaw && npRaw.length >= 4);

    if (!wantsLoginChange && !wantsPasswordChange) {
      throw new BadRequestException('NOTHING_TO_CHANGE');
    }

    if (wantsLoginChange && nlRaw) {
      const taken = await this.prisma.user.findFirst({
        where: { login: nlRaw, NOT: { id: userId } },
      });
      if (taken) throw new ConflictException('LOGIN_TAKEN');
    }

    const data: { login?: string; passwordHash?: string } = {};
    if (wantsLoginChange && nlRaw) data.login = nlRaw;
    if (wantsPasswordChange && npRaw) {
      data.passwordHash = await bcrypt.hash(npRaw, 10);
    }

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data,
      }),
    ]);

    const updated = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!updated) throw new UnauthorizedException();
    return this.buildSession(updated);
  }

  normalizePositions(stored: string[]): string[] {
    if (!stored?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of stored) {
      const s = String(raw).trim();
      if (s.length < 1 || s.length > 80) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= 20) break;
    }
    return out;
  }

  /** ADMIN uchun barcha sahifalar; boshqa rollarda — faqat ruxsat berilganlar */
  normalizeRoutes(role: Role, stored: string[]): AppRouteKey[] {
    if (role === Role.ADMIN) {
      return [...ALL_APP_ROUTES];
    }
    return stored.filter((r): r is AppRouteKey => isAppRouteKey(r));
  }

  private async buildSession(user: {
    id: string;
    login: string;
    fullName: string;
    role: Role;
    allowedRoutes: string[];
    positions: string[];
  }): Promise<SessionPayload> {
    const allowedRoutes = this.normalizeRoutes(user.role, user.allowedRoutes);
    const positions = this.normalizePositions(user.positions);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      login: user.login,
      role: user.role,
      allowedRoutes,
      positions,
    });
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        login: user.login,
        role: user.role,
        allowedRoutes,
        positions,
      },
      accessToken,
      refreshToken,
    };
  }
}
