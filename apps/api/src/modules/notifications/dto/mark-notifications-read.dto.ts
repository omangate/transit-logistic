import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class MarkNotificationsReadDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  notificationIds!: string[];
}
