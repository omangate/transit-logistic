import { IsIn, IsNumber, IsString, MinLength } from 'class-validator';

export class ShipmentStopDto {
  @IsString()
  @MinLength(2)
  address!: string;

  @IsString()
  @MinLength(2)
  city!: string;

  @IsNumber({ maxDecimalPlaces: 7 })
  latitude!: number;

  @IsNumber({ maxDecimalPlaces: 7 })
  longitude!: number;

  @IsIn(['pickup', 'delivery'])
  stopType!: 'pickup' | 'delivery';
}
