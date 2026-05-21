import { Role } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { APP_ROUTE_KEYS } from '../../common/constants/app-routes.js';

const ROUTE_CHOICES = [...APP_ROUTE_KEYS] as string[];

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  login!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ROUTE_CHOICES, { each: true })
  allowedRoutes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  positions?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  login?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ROUTE_CHOICES, { each: true })
  allowedRoutes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  positions?: string[];
}
