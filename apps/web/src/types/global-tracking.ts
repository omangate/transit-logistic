import type { GlobalTrackingSearchType, TrackingMode } from '@transit-logistic/shared';

export type UnifiedTrackingLocation = {
  code?: string;
  name?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

export type UnifiedTrackingEvent = {
  eventType: string;
  eventDateTime: string;
  location?: UnifiedTrackingLocation;
  description?: string;
  source: string;
};

export type UnifiedTrackingResult = {
  mode: TrackingMode;
  reference: string;
  searchType: GlobalTrackingSearchType;
  providerName?: string;
  providerCode?: string;
  currentStatus?: string;
  lastUpdate?: string;
  eta?: string;
  etd?: string;
  nextMilestone?: string;
  dataQuality: 'live' | 'manual' | 'external';
  origin?: UnifiedTrackingLocation;
  destination?: UnifiedTrackingLocation;
  events: UnifiedTrackingEvent[];
  externalTrackingUrl?: string;
  entityId?: string;
  entityType?: string;
  ocean?: {
    vesselName?: string;
    voyage?: string;
    containerNumber?: string;
    blNumber?: string;
    bookingNumber?: string;
    pol?: UnifiedTrackingLocation;
    pod?: UnifiedTrackingLocation;
    transshipmentPorts?: UnifiedTrackingLocation[];
  };
  air?: {
    airline?: string;
    flightNumber?: string;
    awb?: string;
    mawb?: string;
    hawb?: string;
    airportOrigin?: UnifiedTrackingLocation;
    airportDestination?: UnifiedTrackingLocation;
    flightDeparture?: string;
    flightArrival?: string;
  };
  road?: {
    fleetCompany?: string;
    driverName?: string;
    truckIdentifier?: string;
    pickup?: UnifiedTrackingLocation;
    delivery?: UnifiedTrackingLocation;
    livePosition?: {
      latitude: number;
      longitude: number;
      speed?: number | null;
      recordedAt: string;
    };
  };
};

export type TrackingSummary = {
  ocean: { active: number; delayed: number; arrived: number; actionRequired: number };
  air: { active: number; delayed: number; arrived: number; actionRequired: number };
  road: { active: number; delayed: number; arrived: number; actionRequired: number };
  recentReferences: Array<{ reference: string; mode: TrackingMode; status: string; updatedAt: string }>;
};

export type EmailDeliveryLogEntry = {
  id: string;
  recipientEmail: string;
  templateEvent: string;
  entityType: string | null;
  entityId: string | null;
  locale: string;
  subject: string;
  status: string;
  provider: string | null;
  providerMessageId: string | null;
  retryCount: number;
  errorCategory: string | null;
  errorMessage: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
};

export type PaginatedEmailDeliveryLogs = {
  data: EmailDeliveryLogEntry[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type EmailProviderStatus = {
  provider: string;
  configured: boolean;
  from: string;
  replyTo?: string | null;
  webhookConfigured?: boolean;
  missingCredentials?: string[];
};
