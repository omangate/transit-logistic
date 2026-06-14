import { VehicleType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  plateNumber?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  capacityKg?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
