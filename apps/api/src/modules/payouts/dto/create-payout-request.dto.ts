import { Type } from 'class-transformer';
import { IsNumber, Min, ValidateNested } from 'class-validator';

import { BankDetailsDto } from './bank-details.dto';

export class CreatePayoutRequestDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ValidateNested()
  @Type(() => BankDetailsDto)
  bankDetails!: BankDetailsDto;
}
