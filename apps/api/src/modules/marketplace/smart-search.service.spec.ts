import { VehicleType } from '@transit-logistic/shared';

import { SmartSearchService } from './smart-search.service';

describe('SmartSearchService', () => {
  const listings = { browsePublic: jest.fn().mockResolvedValue({ items: [], meta: {} }) };
  const service = new SmartSearchService(listings as never);

  it('parses ton capacity from Arabic query', () => {
    const filters = service.parseQuery('أريد سطحة 20 طن في صلالة');
    expect(filters.minCapacityKg).toBe(20000);
    expect(filters.vehicleType).toBe(VehicleType.FLATBED);
  });

  it('parses English flatbed query', async () => {
    await service.search('Flatbed truck 25 ton available tomorrow in Sohar');
    expect(listings.browsePublic).toHaveBeenCalledWith(
      expect.objectContaining({ minCapacityKg: 25000, vehicleType: VehicleType.FLATBED }),
    );
  });
});
