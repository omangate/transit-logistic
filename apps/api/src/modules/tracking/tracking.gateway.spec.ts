import type { User } from '@/types/user';

import type { ShipmentAccessService } from '../shipments/shipment-access.service';

import type { TrackingAuthService } from './tracking-auth.service';
import type { LiveTrackingPosition } from './tracking-live.types';
import { TrackingGateway } from './tracking.gateway';

describe('TrackingGateway', () => {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    phone: null,
    passwordHash: 'hash',
    role: 'customer',
    locale: 'en',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies User;

  const position: LiveTrackingPosition = {
    id: '1',
    shipmentId: 'shipment-1',
    latitude: '24.7136000',
    longitude: '46.6753000',
    speed: '30.00',
    heading: null,
    recordedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const server = { to };

  const trackingAuth = {
    authenticateSocket: jest.fn().mockResolvedValue(user),
  };

  const access = {
    assertCanView: jest.fn().mockResolvedValue({ id: 'shipment-1' }),
  };

  let gateway: TrackingGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new TrackingGateway(
      trackingAuth as unknown as TrackingAuthService,
      access as unknown as ShipmentAccessService,
    );
    gateway.server = server as never;
  });

  it('publishes live positions to shipment rooms', () => {
    gateway.publishPosition('shipment-1', position);

    expect(to).toHaveBeenCalledWith('shipment:shipment-1');
    expect(emit).toHaveBeenCalledWith('position', position);
  });
});
