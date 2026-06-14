import { IsObject, IsString } from 'class-validator';

export class UpdateSettingsSectionDto {
  @IsString()
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;
}
