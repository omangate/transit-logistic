import { Locale } from '@prisma/client';
import { UserRole as SharedUserRole } from '@transit-logistic/shared';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

const SELF_REGISTER_ROLES = [SharedUserRole.CUSTOMER, SharedUserRole.FLEET_OWNER] as const;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @IsIn(SELF_REGISTER_ROLES, {
    message: 'role must be one of: customer, fleet_owner',
  })
  role!: (typeof SELF_REGISTER_ROLES)[number];

  @ValidateIf((dto: RegisterDto) => dto.role === SharedUserRole.CUSTOMER)
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be in E.164 format (e.g. +966501234567)',
  })
  phone?: string;

  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}
