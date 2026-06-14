export interface CompanySettings {
  nameEn: string;
  nameAr: string;
  email: string;
  phone: string;
  address: string;
}

export interface BrandingSettings {
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
}

export interface EmailSettings {
  provider: string;
  fromAddress: string;
  enabled: boolean;
}

export interface PaymentSettings {
  provider: string;
  currency: string;
  successPath: string;
  cancelPath: string;
}

export interface NotificationSettings {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface PlatformSettings {
  company: CompanySettings;
  branding: BrandingSettings;
  email: EmailSettings;
  payment: PaymentSettings;
  notifications: NotificationSettings;
}

export interface UpdateSettingsInput {
  key: string;
  value: Record<string, unknown>;
}
