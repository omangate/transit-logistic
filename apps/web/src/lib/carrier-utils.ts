import {
  OceanCarrierCode,
  OceanCarrierConnectionStatus,
  OceanCarrierIntegrationMode,
} from '@transit-logistic/shared';

export type CarrierIntegrationBadge =
  | 'live_api'
  | 'external_tracking'
  | 'manual_ops'
  | 'not_configured';

const CARRIER_MONOGRAM: Record<OceanCarrierCode, { initials: string; accent: string }> = {
  [OceanCarrierCode.MAERSK]: { initials: 'M', accent: '#42b0d5' },
  [OceanCarrierCode.HAPAG_LLOYD]: { initials: 'HL', accent: '#ff6600' },
  [OceanCarrierCode.MSC]: { initials: 'MSC', accent: '#003366' },
  [OceanCarrierCode.CMA_CGM]: { initials: 'CMA', accent: '#003d7a' },
  [OceanCarrierCode.COSCO]: { initials: 'CS', accent: '#0054a6' },
  [OceanCarrierCode.ONE]: { initials: 'ONE', accent: '#e60012' },
  [OceanCarrierCode.EVERGREEN]: { initials: 'EVG', accent: '#00843d' },
  [OceanCarrierCode.YANG_MING]: { initials: 'YM', accent: '#e31937' },
  [OceanCarrierCode.ZIM]: { initials: 'ZIM', accent: '#005eb8' },
};

export function getCarrierMonogram(carrierCode: OceanCarrierCode) {
  return CARRIER_MONOGRAM[carrierCode] ?? { initials: carrierCode.slice(0, 2).toUpperCase(), accent: '#334155' };
}

export function resolveCarrierIntegrationBadge(
  mode: OceanCarrierIntegrationMode,
  status: OceanCarrierConnectionStatus,
): CarrierIntegrationBadge {
  if (mode === OceanCarrierIntegrationMode.EXTERNAL_TRACKING) {
    return 'external_tracking';
  }
  if (mode === OceanCarrierIntegrationMode.MANUAL_OPS) {
    return 'manual_ops';
  }
  if (
    status === OceanCarrierConnectionStatus.CONNECTED ||
    status === OceanCarrierConnectionStatus.DEGRADED
  ) {
    return 'live_api';
  }
  return 'not_configured';
}

export function carrierMatchesSearch(
  carrier: { displayName: string; scac?: string | null; carrierCode: string },
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    carrier.displayName.toLowerCase().includes(normalized) ||
    carrier.carrierCode.toLowerCase().includes(normalized) ||
    (carrier.scac?.toLowerCase().includes(normalized) ?? false)
  );
}
