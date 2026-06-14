import { VehicleType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateVehicleDto {
  @IsOptional()
  @IsUUID()
  fleetOwnerId?: string;

  @IsString()
  @MinLength(2)
  plateNumber!: string;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  capacityKg?: number;
}
