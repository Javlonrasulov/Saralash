import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateIntakeDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(2)
  materialName!: string;

  @IsNumber()
  @IsPositive()
  weightKg!: number;

  @IsOptional()
  @IsString()
  sourceCustomerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DistributeRowDto {
  @IsString()
  categoryKey!: string;

  @IsNumber()
  @IsPositive()
  weightKg!: number;
}

export class DistributeIntakeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributeRowDto)
  rows!: DistributeRowDto[];
}

export class PressSourceDto {
  @IsString()
  sortedMaterialId!: string;

  @IsNumber()
  @IsPositive()
  takeKg!: number;
}

export class PressBatchDto {
  @IsString()
  productName!: string;

  @IsString()
  categoryKey!: string;

  @IsNumber()
  @IsPositive()
  outputKg!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PressSourceDto)
  sources!: PressSourceDto[];
}
