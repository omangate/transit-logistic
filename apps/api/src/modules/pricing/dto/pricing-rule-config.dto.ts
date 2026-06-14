import { VehicleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class VehicleMultiplierConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  flatbed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  refrigerated?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  container?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  tanker?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  other?: number;
}

export class PricingRuleConfigDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseFare!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  perKmRate!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumFare!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  platformFeePercent!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => VehicleMultiplierConfigDto)
  vehicleMultipliers!: VehicleMultiplierConfigDto;
}

export function toVehicleMultiplierRecord(
  multipliers: VehicleMultiplierConfigDto,
): Partial<Record<VehicleType, number>> {
  return {
    ...(multipliers.flatbed !== undefined ? { [VehicleType.flatbed]: multipliers.flatbed } : {}),
    ...(multipliers.refrigerated !== undefined
      ? { [VehicleType.refrigerated]: multipliers.refrigerated }
      : {}),
    ...(multipliers.container !== undefined ? { [VehicleType.container]: multipliers.container } : {}),
    ...(multipliers.tanker !== undefined ? { [VehicleType.tanker]: multipliers.tanker } : {}),
    ...(multipliers.other !== undefined ? { [VehicleType.other]: multipliers.other } : {}),
  };
}
