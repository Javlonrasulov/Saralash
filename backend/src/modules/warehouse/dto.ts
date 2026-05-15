import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export enum WarehouseUnitDto {
  KG = 'KG',
  PCS = 'PCS',
}

export enum OutcomeTypeDto {
  SOLD = 'SOLD',
  CONSUMED = 'CONSUMED',
}

export class CreateWarehouseItemDto {
  @IsString()
  @MinLength(2)
  productName!: string;

  @IsString()
  categoryKey!: string;

  @IsEnum(WarehouseUnitDto)
  unit!: WarehouseUnitDto;

  @IsNumber()
  @IsPositive()
  initialQty!: number;

  @IsDateString()
  incomeDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWarehouseItemDto {
  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  categoryKey?: string;

  @IsOptional()
  @IsEnum(WarehouseUnitDto)
  unit?: WarehouseUnitDto;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  initialQty?: number;

  @IsOptional()
  @IsDateString()
  incomeDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOutcomeDto {
  @IsEnum(OutcomeTypeDto)
  type!: OutcomeTypeDto;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsNumber()
  pricePerUnit?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
