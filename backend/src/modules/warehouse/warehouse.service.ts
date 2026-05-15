import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateOutcomeDto,
  CreateWarehouseItemDto,
  OutcomeTypeDto,
  UpdateWarehouseItemDto,
} from './dto.js';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { q?: string; categoryKey?: string }) {
    const cat = params.categoryKey
      ? await this.prisma.sortCategory.findUnique({ where: { key: params.categoryKey } })
      : null;
    return this.prisma.warehouseItem.findMany({
      where: {
        ...(cat && { categoryId: cat.id }),
        ...(params.q && {
          OR: [
            { productName: { contains: params.q, mode: 'insensitive' } },
            { notes: { contains: params.q, mode: 'insensitive' } },
          ],
        }),
      },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateWarehouseItemDto) {
    const category = await this.prisma.sortCategory.findUnique({ where: { key: dto.categoryKey } });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    return this.prisma.warehouseItem.create({
      data: {
        productName: dto.productName.trim(),
        categoryId: category.id,
        unit: dto.unit,
        initialQty: dto.initialQty,
        currentQty: dto.initialQty,
        incomeDate: new Date(dto.incomeDate),
        source: 'EXTERNAL',
        notes: dto.notes ?? null,
      },
      include: { category: true },
    });
  }

  async update(id: string, dto: UpdateWarehouseItemDto) {
    const existing = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Mahsulot topilmadi');

    let categoryId = existing.categoryId;
    if (dto.categoryKey) {
      const c = await this.prisma.sortCategory.findUnique({ where: { key: dto.categoryKey } });
      if (!c) throw new NotFoundException('Kategoriya topilmadi');
      categoryId = c.id;
    }
    const initialQty = dto.initialQty ?? existing.initialQty;
    const delta = initialQty - existing.initialQty;
    return this.prisma.warehouseItem.update({
      where: { id },
      data: {
        ...(dto.productName !== undefined && { productName: dto.productName.trim() }),
        categoryId,
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.initialQty !== undefined && {
          initialQty,
          currentQty: existing.currentQty + delta,
        }),
        ...(dto.incomeDate !== undefined && { incomeDate: new Date(dto.incomeDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { category: true },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Mahsulot topilmadi');
    await this.prisma.warehouseItem.delete({ where: { id } });
    return { ok: true };
  }

  // ========== OUTCOMES ==========
  async createOutcome(itemId: string, dto: CreateOutcomeDto) {
    const item = await this.prisma.warehouseItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Mahsulot topilmadi');
    if (dto.quantity > item.currentQty + 0.001) {
      throw new BadRequestException('Sotuv/chiqim miqdori qoldiqdan katta');
    }

    return this.prisma.$transaction(async (tx) => {
      const totalAmount =
        dto.type === OutcomeTypeDto.SOLD && dto.pricePerUnit !== undefined
          ? dto.pricePerUnit * dto.quantity
          : null;

      const outcome = await tx.warehouseOutcome.create({
        data: {
          warehouseItemId: itemId,
          type: dto.type,
          quantity: dto.quantity,
          unit: item.unit,
          date: new Date(dto.date),
          customerId: dto.customerId ?? null,
          customerName: dto.customerName ?? null,
          pricePerUnit: dto.pricePerUnit ?? null,
          totalAmount,
          reason: dto.reason ?? null,
          notes: dto.notes ?? null,
        },
      });

      const newQty = Math.max(0, item.currentQty - dto.quantity);
      await tx.warehouseItem.update({
        where: { id: itemId },
        data: {
          currentQty: newQty,
          status:
            newQty <= 0
              ? dto.type === OutcomeTypeDto.SOLD
                ? 'SOLD_OUT'
                : 'CONSUMED_OUT'
              : 'IN_STOCK',
        },
      });

      // Klient summasini yangilash
      if (dto.type === OutcomeTypeDto.SOLD && dto.customerId && totalAmount && totalAmount > 0) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: {
            lastPurchaseDate: new Date(dto.date),
            totalSpent: { increment: totalAmount },
          },
        });
      }

      return outcome;
    });
  }

  listOutcomes(type?: OutcomeTypeDto) {
    return this.prisma.warehouseOutcome.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouseItem: { select: { id: true, productName: true } },
        customer: { select: { id: true, fullName: true } },
      },
    });
  }
}
