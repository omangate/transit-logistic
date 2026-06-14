import { UserRole } from '@transit-logistic/shared';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class BroadcastNotificationDto {
  @IsString()
  @MaxLength(200)
  titleEn!: string;

  @IsString()
  @MaxLength(200)
  titleAr!: string;

  @IsString()
  @MaxLength(1000)
  bodyEn!: string;

  @IsString()
  @MaxLength(1000)
  bodyAr!: string;

  @ValidateIf((dto: BroadcastNotificationDto) => !dto.userIds?.length)
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ValidateIf((dto: BroadcastNotificationDto) => !dto.roles?.length)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
