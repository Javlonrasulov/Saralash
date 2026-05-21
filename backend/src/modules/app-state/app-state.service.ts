import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

const SHARED_ID = 'shared';

@Injectable()
export class AppStateService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const row = await this.prisma.appSnapshot.findUnique({ where: { id: SHARED_ID } });
    if (!row) return { payload: null, updatedAt: null };
    return {
      payload: row.payload,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async put(userId: string, payload: Record<string, unknown>) {
    const row = await this.prisma.appSnapshot.upsert({
      where: { id: SHARED_ID },
      create: {
        id: SHARED_ID,
        payload: payload as Prisma.InputJsonValue,
        updatedBy: userId,
      },
      update: {
        payload: payload as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    });
    return { updatedAt: row.updatedAt.toISOString() };
  }
}
