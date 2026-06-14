import { CargoType, ShippingMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import { ShipmentStopDto } from './shipment-stop.dto';

export class CreateShipmentDto {
  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @IsOptional()
  @IsString()
  cargoDescription?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packageCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  lengthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  widthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  heightCm?: number;

  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod;

  @IsOptional()
  @IsBoolean()
  isCrossBorder?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentStopDto)
  stops!: ShipmentStopDto[];
}