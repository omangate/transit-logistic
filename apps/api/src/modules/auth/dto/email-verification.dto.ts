import { IsEmail, IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @MinLength(16)
  token!: string;
}

export class UpdateEmailDto {
  @IsEmail()
  email!: string;
}

export class UpdateEmailPreferencesDto {
  marketing?: boolean;
  recommendations?: boolean;
  generalUpdates?: boolean;
  messageEmails?: boolean;
  adminAlerts?: boolean;
}
