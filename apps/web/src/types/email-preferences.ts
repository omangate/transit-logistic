export interface EmailPreferences {
  marketing: boolean;
  recommendations: boolean;
  generalUpdates: boolean;
  messageEmails: boolean;
  adminAlerts: boolean;
}

export interface UpdateEmailPreferencesInput {
  marketing?: boolean;
  recommendations?: boolean;
  generalUpdates?: boolean;
  messageEmails?: boolean;
  adminAlerts?: boolean;
}
