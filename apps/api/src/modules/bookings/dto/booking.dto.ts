import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

import { QueryInt } from '../../../common/dto/query-transforms';

export class CreateAvailabilityBlockDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsEnum(['available', 'busy', 'maintenance', 'blocked'])
  blockType!: 'available' | 'busy' | 'maintenance' | 'blocked';

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}

export class CreateBookingDto {
  @IsUUID()
  truckListingId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  withDriver?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BookingQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired'])
  status?: string;

  @IsOptional()
  @QueryInt()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @QueryInt()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class QuoteFleetActionDto {
  @IsEnum(['accept', 'reject', 'counter', 'request_info'])
  action!: 'accept' | 'reject' | 'counter' | 'request_info';

  @IsOptional()
  @Type(() => Number)
  quotedAmount?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fleetResponse?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class QuoteCustomerActionDto {
  @IsEnum(['accept', 'reject', 'cancel'])
  action!: 'accept' | 'reject' | 'cancel';

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateBookingFromQuoteDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
