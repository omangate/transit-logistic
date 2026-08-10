import { FleetLogisticsService } from './fleet-logistics.service';

describe('FleetLogisticsService', () => {
  const fleetOwner = { id: 'fo-1', userId: 'fleet-user' };
  const fleetUser = { id: 'fleet-user', role: 'fleet_owner' } as never;

  const prisma = {
    shipment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    truckBooking: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    logisticsOrder: {
      findMany: jest.fn(),
    },
  };

  const fleetOwnership = {
    requireFleetOwner: jest.fn(),
  };

  const service = new FleetLogisticsService(prisma as never, fleetOwnership as never);

  beforeEach(() => {
    jest.clearAllMocks();
    fleetOwnership.requireFleetOwner.mockResolvedValue(fleetOwner);
    prisma.shipment.count.mockResolvedValue(2);
    prisma.truckBooking.count.mockResolvedValue(1);
    prisma.shipment.findMany.mockResolvedValue([{ id: 's1', referenceNumber: 'SH-1', status: 'assigned' }]);
    prisma.truckBooking.findMany.mockResolvedValue([{ id: 'b1', status: 'confirmed', startDate: new Date(), endDate: new Date(), truckListing: { name: 'Truck' } }]);
    prisma.logisticsOrder.findMany.mockResolvedValue([{ id: 'lo1', referenceNumber: 'LO-1', status: 'in_progress', title: 'Order' }]);
  });

  it('returns fleet-scoped dashboard data', async () => {
    const result = await service.getDashboard(fleetUser);

    expect(fleetOwnership.requireFleetOwner).toHaveBeenCalledWith(fleetUser);
    expect(result.counts.assignedShipments).toBe(2);
    expect(result.recentShipments).toHaveLength(1);
    expect(result.linkedOrders).toHaveLength(1);
    expect(prisma.logisticsOrder.findMany).toHaveBeenCalled();
  });
});
