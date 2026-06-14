import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdminWalletOperationDto {
  @IsUUID()
  userId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
