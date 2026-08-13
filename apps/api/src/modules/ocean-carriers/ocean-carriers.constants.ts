import {
  OceanCarrierCode,
  OceanCarrierConnectionStatus,
  OceanCarrierIntegrationMode,
} from '@transit-logistic/shared';

export type CarrierSeedDefinition = {
  carrierCode: OceanCarrierCode;
  displayName: string;
  scac: string;
  externalTrackingUrlTemplate: string;
  credentialEnvKey: string;
};

export const CARRIER_SEED_DEFINITIONS: CarrierSeedDefinition[] = [
  {
    carrierCode: OceanCarrierCode.MAERSK,
    displayName: 'Maersk',
    scac: 'MAEU',
    externalTrackingUrlTemplate: 'https://www.maersk.com/tracking/{reference}',
    credentialEnvKey: 'MAERSK_API_CLIENT_ID',
  },
  {
    carrierCode: OceanCarrierCode.HAPAG_LLOYD,
    displayName: 'Hapag-Lloyd',
    scac: 'HLCU',
    externalTrackingUrlTemplate:
      'https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?booking={reference}',
    credentialEnvKey: 'HAPAG_LLOYD_API_KEY',
  },
  {
    carrierCode: OceanCarrierCode.MSC,
    displayName: 'MSC',
    scac: 'MSCU',
    externalTrackingUrlTemplate: 'https://www.msc.com/en/track-a-shipment?params={reference}',
    credentialEnvKey: 'MSC_API_KEY',
  },
  {
    carrierCode: OceanCarrierCode.CMA_CGM,
    displayName: 'CMA CGM',
    scac: 'CMDU',
    externalTrackingUrlTemplate:
      'https://www.cma-cgm.com/ebusiness/tracking/search?SearchType=Container&SearchBy={reference}',
    credentialEnvKey: 'CMA_CGM_API_KEY',
  },
  {
    carrierCode: OceanCarrierCode.COSCO,
    displayName: 'COSCO Shipping',
    scac: 'COSU',
    externalTrackingUrlTemplate:
      'https://elines.coscoshipping.com/ebusiness/cargoTracking?containerNo={reference}',
    credentialEnvKey: 'COSCO_API_KEY',
  },
  {
    carrierCode: OceanCarrierCode.ONE,
    displayName: 'Ocean Network Express',
    scac: 'ONEY',
    externalTrackingUrlTemplate:
      'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?searchType=Container&searchNumber={reference}',
    credentialEnvKey: 'ONE_API_KEY',
  },
  {
    carrierCode: OceanCarrierCode.EVERGREEN,
    displayName: 'Evergreen Line',
    scac: 'EGLV',
    externalTrackingUrlTemplate:
      'https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do?containerNo={reference}',
    credentialEnvKey: 'EVERGREEN_API_KEY',
  },
  {
    carrierCode: OceanCarrierCode.YANG_MING,
    displayName: 'Yang Ming',
    scac: 'YMLU',
    externalTrackingUrlTemplate:
      'https://www.yangming.com/en/esolution/cargo_tracking?containerNo={reference}',
    credentialEnvKey: 'YANG_MING_API_KEY',
  },
  {
    carrierCode: OceanCarrierCode.ZIM,
    displayName: 'ZIM',
    scac: 'ZIMU',
    externalTrackingUrlTemplate: 'https://www.zim.com/tools/track-a-shipment?container={reference}',
    credentialEnvKey: 'ZIM_API_KEY',
  },
];

export function resolveCredentialConfigured(credentialEnvKey?: string | null): boolean {
  if (!credentialEnvKey) {
    return false;
  }
  const value = process.env[credentialEnvKey]?.trim();
  return Boolean(value);
}

export function resolveIntegrationStatus(
  credentialConfigured: boolean,
  integrationMode: OceanCarrierIntegrationMode,
  lastError?: string | null,
  lastSuccessfulSync?: Date | null,
): OceanCarrierConnectionStatus {
  if (integrationMode === OceanCarrierIntegrationMode.MANUAL_OPS) {
    return OceanCarrierConnectionStatus.CONNECTED;
  }
  if (integrationMode === OceanCarrierIntegrationMode.EXTERNAL_TRACKING) {
    return OceanCarrierConnectionStatus.CONNECTED;
  }
  if (integrationMode === OceanCarrierIntegrationMode.LIVE_API) {
    if (!credentialConfigured) {
      return OceanCarrierConnectionStatus.AUTH_REQUIRED;
    }
    if (lastError) {
      return OceanCarrierConnectionStatus.ERROR;
    }
    if (lastSuccessfulSync) {
      return OceanCarrierConnectionStatus.CONNECTED;
    }
    return OceanCarrierConnectionStatus.NOT_CONFIGURED;
  }
  return OceanCarrierConnectionStatus.NOT_CONFIGURED;
}

export function buildExternalTrackingUrl(template: string | null | undefined, reference: string): string | undefined {
  if (!template) {
    return undefined;
  }
  return template.replace('{reference}', encodeURIComponent(reference));
}
