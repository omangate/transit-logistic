import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CargoType, VehicleType } from '@transit-logistic/shared';

export class CreateShipmentRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  pickupAddress!: string;

  @IsOptional()
  @IsUUID()
  pickupGeoRegionId?: string;

  @IsOptional()
  @IsNumber()
  pickupLatitude?: number;

  @IsOptional()
  @IsNumber()
  pickupLongitude?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  deliveryAddress!: string;

  @IsOptional()
  @IsUUID()
  deliveryGeoRegionId?: string;

  @IsOptional()
  @IsNumber()
  deliveryLatitude?: number;

  @IsOptional()
  @IsNumber()
  deliveryLongitude?: number;

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  requiredVehicleType?: VehicleType;

  @IsOptional()
  @IsBoolean()
  requiresRefrigerated?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresCrossBorder?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresContainer?: boolean;
}
