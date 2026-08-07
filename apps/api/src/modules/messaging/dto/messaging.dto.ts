import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsUUID()
  fleetOwnerId?: string;
}
