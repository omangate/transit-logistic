import { ForbiddenException } from '@nestjs/common';

import type { User } from '@/types/user';

import { LogisticsAccessService } from './logistics-access.service';

describe('LogisticsAccessService RBAC', () => {
  const prisma = {
    logisticsOrder: { findUnique: jest.fn() },
    customsClearanceRequest: { findUnique: jest.fn() },
    freightForwardingRequest: { findUnique: jest.fn() },
  };

  const service = new LogisticsAccessService(prisma as never);

  const customerA = { id: 'aaa', role: 'customer' } as User;
  const customerB = { id: 'bbb', role: 'customer' } as User;
  const fleet = { id: 'fff', role: 'fleet_owner' } as User;
  const admin = { id: 'adm', role: 'admin' } as User;

  beforeEach(() => jest.clearAllMocks());

  it('allows admin to access any order', async () => {
    prisma.logisticsOrder.findUnique.mockResolvedValue({ id: 'o1', customerId: customerA.id });
    await expect(service.assertOrderAccess(admin, 'o1')).resolves.toMatchObject({ id: 'o1' });
  });

  it('allows owner customer to access their order', async () => {
    prisma.logisticsOrder.findUnique.mockResolvedValue({ id: 'o1', customerId: customerA.id });
    await expect(service.assertOrderAccess(customerA, 'o1')).resolves.toMatchObject({ id: 'o1' });
  });

  it('forbids other customers from accessing orders', async () => {
    prisma.logisticsOrder.findUnique.mockResolvedValue({ id: 'o1', customerId: customerA.id });
    await expect(service.assertOrderAccess(customerB, 'o1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids fleet owner from accessing customer orders', async () => {
    prisma.logisticsOrder.findUnique.mockResolvedValue({ id: 'o1', customerId: customerA.id });
    await expect(service.assertOrderAccess(fleet, 'o1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids non-admin non-owner from customs request', async () => {
    prisma.customsClearanceRequest.findUnique.mockResolvedValue({ id: 'c1', customerId: customerA.id });
    await expect(service.assertCustomsAccess(customerB, 'c1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
