import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  subject!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsUUID()
  paymentId?: string;
}

export class AddTicketMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(['open', 'in_progress', 'resolved', 'closed'])
  status!: 'open' | 'in_progress' | 'resolved' | 'closed';
}
