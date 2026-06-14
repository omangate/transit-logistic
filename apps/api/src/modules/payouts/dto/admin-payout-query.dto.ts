import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { type PayoutApiStatus } from '../payout-status.util';

export class AdminPayoutQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'paid'])
  status?: PayoutApiStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
