import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateFleetProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;
}
