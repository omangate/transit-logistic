import { IsUUID } from 'class-validator';

export class AcceptShipmentDto {
  @IsUUID()
  vehicleId!: string;

  @IsUUID()
  driverId!: string;
}
