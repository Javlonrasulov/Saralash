import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service.js';
import {
  CreateOutcomeDto,
  CreateWarehouseItemDto,
  OutcomeTypeDto,
  UpdateWarehouseItemDto,
} from './dto.js';

@ApiTags('warehouse')
@ApiBearerAuth()
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly service: WarehouseService) {}

  @Get('items')
  list(@Query('q') q?: string, @Query('category') categoryKey?: string) {
    return this.service.list({ q, categoryKey });
  }

  @Post('items')
  create(@Body() dto: CreateWarehouseItemDto) {
    return this.service.create(dto);
  }

  @Patch('items/:id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseItemDto) {
    return this.service.update(id, dto);
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('items/:id/outcomes')
  createOutcome(@Param('id') id: string, @Body() dto: CreateOutcomeDto) {
    return this.service.createOutcome(id, dto);
  }

  @Get('outcomes')
  listOutcomes(@Query('type') type?: OutcomeTypeDto) {
    return this.service.listOutcomes(type);
  }
}
