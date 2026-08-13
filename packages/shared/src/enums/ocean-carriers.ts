export const OceanCarrierCode = {
  MAERSK: 'maersk',
  HAPAG_LLOYD: 'hapag_lloyd',
  MSC: 'msc',
  CMA_CGM: 'cma_cgm',
  COSCO: 'cosco',
  ONE: 'one',
  EVERGREEN: 'evergreen',
  YANG_MING: 'yang_ming',
  ZIM: 'zim',
} as const;

export type OceanCarrierCode = (typeof OceanCarrierCode)[keyof typeof OceanCarrierCode];

export const OceanCarrierIntegrationMode = {
  LIVE_API: 'live_api',
  MANUAL_OPS: 'manual_ops',
  EXTERNAL_TRACKING: 'external_tracking',
} as const;

export type OceanCarrierIntegrationMode =
  (typeof OceanCarrierIntegrationMode)[keyof typeof OceanCarrierIntegrationMode];

export const OceanCarrierConnectionStatus = {
  CONNECTED: 'connected',
  NOT_CONFIGURED: 'not_configured',
  AUTH_REQUIRED: 'auth_required',
  DEGRADED: 'degraded',
  ERROR: 'error',
} as const;

export type OceanCarrierConnectionStatus =
  (typeof OceanCarrierConnectionStatus)[keyof typeof OceanCarrierConnectionStatus];

export const OceanTrackingSearchType = {
  CONTAINER: 'container',
  BILL_OF_LADING: 'bill_of_lading',
  BOOKING: 'booking',
  REFERENCE: 'reference',
} as const;

export type OceanTrackingSearchType =
  (typeof OceanTrackingSearchType)[keyof typeof OceanTrackingSearchType];

export const DcsaTransportEventType = {
  ARRIVAL: 'arrival',
  DEPARTURE: 'departure',
  LOAD: 'load',
  DISCHARGE: 'discharge',
  GATE_IN: 'gate_in',
  GATE_OUT: 'gate_out',
  TRANSSHIPMENT: 'transshipment',
  OTHER: 'other',
} as const;

export type DcsaTransportEventType =
  (typeof DcsaTransportEventType)[keyof typeof DcsaTransportEventType];
