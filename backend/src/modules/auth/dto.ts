import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  identifier!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ChangeCredentialsDto {
  @IsString()
  @MinLength(4)
  currentPassword!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  newLogin?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @MinLength(4)
  newPassword?: string;
}
