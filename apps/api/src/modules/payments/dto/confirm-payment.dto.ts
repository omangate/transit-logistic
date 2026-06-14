import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @Length(13, 19)
  @Matches(/^\d+$/)
  cardNumber!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^\d{2}$/)
  expiryMonth?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^\d{2}$/)
  expiryYear?: string;

  @IsOptional()
  @IsString()
  @Length(3, 4)
  @Matches(/^\d+$/)
  cvc?: string;
}
