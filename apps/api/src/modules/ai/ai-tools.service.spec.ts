import { UserRole } from '@transit-logistic/shared';

import { AiToolsService } from './ai-tools.service';

describe('AiToolsService RBAC', () => {
  const prisma = {
    truckQuoteRequest: { findUnique: jest.fn() },
    shipment: { findUnique: jest.fn() },
    fleetOwner: { findFirst: jest.fn() },
  };
  const listings = { browsePublic: jest.fn(), getPublicBySlug: jest.fn() };
  const adminDashboard = { getMetrics: jest.fn() };

  const service = new AiToolsService(
    prisma as never,
    listings as never,
    adminDashboard as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('denies customer access to another customer quote', async () => {
    prisma.truckQuoteRequest.findUnique.mockResolvedValue({
      id: 'q1',
      customerId: 'other-user',
      truckListing: { name: 'Truck', slug: 'truck' },
    });

    const result = await service.execute(
      { id: 'user-1', role: UserRole.CUSTOMER } as never,
      'getQuoteStatus',
      { quoteId: 'q1' },
    );

    expect(result).toEqual({ error: 'forbidden' });
  });

  it('denies fleet owner admin metrics', async () => {
    const result = await service.execute(
      { id: 'fleet-1', role: UserRole.FLEET_OWNER } as never,
      'getAdminMetrics',
      {},
    );

    expect(result).toEqual({ error: 'forbidden' });
  });

  it('allows admin metrics for admin role', async () => {
    adminDashboard.getMetrics.mockResolvedValue({ totalShipments: 5 });
    const result = await service.execute(
      { id: 'admin-1', role: UserRole.ADMIN } as never,
      'getAdminMetrics',
      {},
    );
    expect(result).toEqual({ totalShipments: 5 });
  });
});
