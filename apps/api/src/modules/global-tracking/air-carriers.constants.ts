export type AirCarrierSeed = {
  carrierCode: string;
  displayName: string;
  iataPrefix: string;
  externalTrackingUrlTemplate: string;
  credentialEnvKey: string;
};

export const AIR_CARRIER_SEEDS: AirCarrierSeed[] = [
  {
    carrierCode: 'emirates_skycargo',
    displayName: 'Emirates SkyCargo',
    iataPrefix: '176',
    externalTrackingUrlTemplate: 'https://www.skycargo.com/track-shipment?awb={reference}',
    credentialEnvKey: 'EMIRATES_CARGO_API_KEY',
  },
  {
    carrierCode: 'qatar_airways_cargo',
    displayName: 'Qatar Airways Cargo',
    iataPrefix: '157',
    externalTrackingUrlTemplate: 'https://www.qrcargo.com/track-and-trace?awb={reference}',
    credentialEnvKey: 'QATAR_CARGO_API_KEY',
  },
  {
    carrierCode: 'lufthansa_cargo',
    displayName: 'Lufthansa Cargo',
    iataPrefix: '020',
    externalTrackingUrlTemplate: 'https://www.lufthansa-cargo.com/en/track-and-trace?awb={reference}',
    credentialEnvKey: 'LUFTHANSA_CARGO_API_KEY',
  },
  {
    carrierCode: 'turkish_cargo',
    displayName: 'Turkish Cargo',
    iataPrefix: '235',
    externalTrackingUrlTemplate: 'https://www.turkishcargo.com/en/online-services/shipment-tracking?quickAwbn={reference}',
    credentialEnvKey: 'TURKISH_CARGO_API_KEY',
  },
  {
    carrierCode: 'etihad_cargo',
    displayName: 'Etihad Cargo',
    iataPrefix: '607',
    externalTrackingUrlTemplate: 'https://www.etihadcargo.com/en/e-services/track-and-trace?awb={reference}',
    credentialEnvKey: 'ETIHAD_CARGO_API_KEY',
  },
  {
    carrierCode: 'oman_air_cargo',
    displayName: 'Oman Air Cargo',
    iataPrefix: '910',
    externalTrackingUrlTemplate: 'https://www.omanair.com/cargo/track?awb={reference}',
    credentialEnvKey: 'OMAN_AIR_CARGO_API_KEY',
  },
];

export function resolveAirCredentialConfigured(credentialEnvKey?: string | null): boolean {
  if (!credentialEnvKey) return false;
  return Boolean(process.env[credentialEnvKey]?.trim());
}

export function buildAirExternalTrackingUrl(template: string, reference: string): string {
  return template.replace('{reference}', encodeURIComponent(reference.replace(/-/g, '')));
}

export function resolveAirlineFromAwb(awb: string): AirCarrierSeed | null {
  const digits = awb.replace(/\D/g, '');
  if (digits.length < 3) return null;
  const prefix = digits.slice(0, 3);
  return AIR_CARRIER_SEEDS.find((carrier) => carrier.iataPrefix === prefix) ?? null;
}
