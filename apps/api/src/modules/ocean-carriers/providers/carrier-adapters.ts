import { OceanCarrierCode } from '@transit-logistic/shared';

import type { OceanCarrierProvider } from '../ocean-carrier-provider.interface';
import { CARRIER_SEED_DEFINITIONS } from '../ocean-carriers.constants';
import { BaseOceanCarrierAdapter } from './base-ocean-carrier.adapter';

function configFor(carrierCode: OceanCarrierCode) {
  const definition = CARRIER_SEED_DEFINITIONS.find((item) => item.carrierCode === carrierCode);
  if (!definition) {
    throw new Error(`Missing carrier definition for ${carrierCode}`);
  }
  return definition;
}

class MaerskOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.MAERSK;
  readonly displayName = 'Maersk';
  protected getConfig() {
    return configFor(OceanCarrierCode.MAERSK);
  }
}

class HapagLloydOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.HAPAG_LLOYD;
  readonly displayName = 'Hapag-Lloyd';
  protected getConfig() {
    return configFor(OceanCarrierCode.HAPAG_LLOYD);
  }
}

class MscOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.MSC;
  readonly displayName = 'MSC';
  protected getConfig() {
    return configFor(OceanCarrierCode.MSC);
  }
}

class CmaCgmOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.CMA_CGM;
  readonly displayName = 'CMA CGM';
  protected getConfig() {
    return configFor(OceanCarrierCode.CMA_CGM);
  }
}

class CoscoOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.COSCO;
  readonly displayName = 'COSCO Shipping';
  protected getConfig() {
    return configFor(OceanCarrierCode.COSCO);
  }
}

class OneOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.ONE;
  readonly displayName = 'Ocean Network Express';
  protected getConfig() {
    return configFor(OceanCarrierCode.ONE);
  }
}

class EvergreenOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.EVERGREEN;
  readonly displayName = 'Evergreen Line';
  protected getConfig() {
    return configFor(OceanCarrierCode.EVERGREEN);
  }
}

class YangMingOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.YANG_MING;
  readonly displayName = 'Yang Ming';
  protected getConfig() {
    return configFor(OceanCarrierCode.YANG_MING);
  }
}

class ZimOceanCarrierAdapter extends BaseOceanCarrierAdapter {
  readonly carrierCode = OceanCarrierCode.ZIM;
  readonly displayName = 'ZIM';
  protected getConfig() {
    return configFor(OceanCarrierCode.ZIM);
  }
}

export function createOceanCarrierProviders(): OceanCarrierProvider[] {
  return [
    new MaerskOceanCarrierAdapter(),
    new HapagLloydOceanCarrierAdapter(),
    new MscOceanCarrierAdapter(),
    new CmaCgmOceanCarrierAdapter(),
    new CoscoOceanCarrierAdapter(),
    new OneOceanCarrierAdapter(),
    new EvergreenOceanCarrierAdapter(),
    new YangMingOceanCarrierAdapter(),
    new ZimOceanCarrierAdapter(),
  ];
}
