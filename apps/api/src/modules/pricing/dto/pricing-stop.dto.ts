import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class PricingStopDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  latitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence?: number;
}
