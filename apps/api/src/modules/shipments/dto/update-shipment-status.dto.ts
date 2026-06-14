import { ShipmentStatus } from '@transit-logistic/shared';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShipmentStatusDto {
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
