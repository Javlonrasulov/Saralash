import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ALL_APP_ROUTES, isAppRouteKey } from '../../common/constants/app-routes.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateUserDto, UpdateUserDto } from './dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private persistRoutes(role: Role, routes: string[] | undefined): string[] {
    if (role === Role.ADMIN) return [...ALL_APP_ROUTES];
    const list = routes ?? [];
    return list.filter((r): r is (typeof ALL_APP_ROUTES)[number] => isAppRouteKey(r));
  }

  /** Ish lavozimlari — takrorlarsiz, 20 tagacha, har biri 1–80 belgi */
  private normalizePositions(pos: string[] | undefined): string[] {
    if (!pos?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of pos) {
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

  async list() {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        allowedRoutes: true,
        positions: true,
        isActive: true,
        createdAt: true,
      },
    });
    return rows;
  }

  async create(dto: CreateUserDto) {
    const login = dto.login.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { login } });
    if (exists) throw new ConflictException('Bu login band');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const allowedRoutes = this.persistRoutes(dto.role, dto.allowedRoutes);
    const positions = this.normalizePositions(dto.positions);

    return this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        login,
        passwordHash,
        role: dto.role,
        allowedRoutes,
        positions,
      },
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        allowedRoutes: true,
        positions: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();

    if (dto.role != null && dto.role !== Role.ADMIN && user.role === Role.ADMIN) {
      const otherAdmins = await this.prisma.user.count({
        where: { role: Role.ADMIN, id: { not: id } },
      });
      if (otherAdmins === 0) throw new BadRequestException("So'nggi admin rolini olib tashlab bo'lmaydi");
    }

    const nextRole = dto.role ?? user.role;
    const nextRoutes =
      dto.allowedRoutes !== undefined || dto.role !== undefined
        ? this.persistRoutes(nextRole, dto.allowedRoutes ?? user.allowedRoutes)
        : user.allowedRoutes;

    if (actorId === id && dto.isActive === false) throw new ForbiddenException("O'zingizni o'chirib bo'lmaydi");

    const data: {
      fullName?: string;
      passwordHash?: string;
      role?: Role;
      allowedRoutes?: string[];
      positions?: string[];
      isActive?: boolean;
    } = {};

    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.allowedRoutes !== undefined || dto.role !== undefined) data.allowedRoutes = nextRoutes;
    if (dto.positions !== undefined) data.positions = this.normalizePositions(dto.positions);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        allowedRoutes: true,
        positions: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async remove(actorId: string, id: string) {
    if (actorId === id) throw new ForbiddenException("O'zingizni o'chirib bo'lmaydi");

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();

    if (user.role === Role.ADMIN) {
      const other = await this.prisma.user.count({ where: { role: Role.ADMIN, id: { not: id } } });
      if (other === 0) throw new BadRequestException("So'nggi adminni o'chirib bo'lmaydi");
    }

    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
