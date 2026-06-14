import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BankDetailsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  accountHolderName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(34)
  iban!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  swiftCode?: string;
}
