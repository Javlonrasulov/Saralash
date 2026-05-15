import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCustomerDto, UpdateCustomerDto } from './dto.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(query?: string) {
    const q = query?.trim();
    return this.prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { address: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Klient topilmadi');
    return customer;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        address: dto.address?.trim() ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.getById(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.address !== undefined && { address: dto.address?.trim() ?? null }),
      },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.customer.delete({ where: { id } });
    return { ok: true };
  }
}
