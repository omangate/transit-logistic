import { IsUUID } from 'class-validator';

export class AssignShipmentDto {
  @IsUUID()
  fleetOwnerId!: string;

  @IsUUID()
  vehicleId!: string;

  @IsUUID()
  driverId!: string;
}
