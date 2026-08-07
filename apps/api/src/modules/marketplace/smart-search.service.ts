import { Injectable } from '@nestjs/common';
import { VehicleType } from '@transit-logistic/shared';

import { TruckListingsService } from '../marketplace/truck-listings.service';

@Injectable()
export class SmartSearchService {
  constructor(private readonly listings: TruckListingsService) {}

  parseQuery(query: string) {
    const q = query.trim();
    const lower = q.toLowerCase();
    const filters: Record<string, unknown> = { search: q, page: 1, limit: 12 };

    const tonMatch = q.match(/(\d+)\s*(?:ton|tonne|tons|طن)/i);
    if (tonMatch) filters.minCapacityKg = Number(tonMatch[1]) * 1000;

    if (/flatbed|سطحة|سطحه/.test(lower)) filters.vehicleType = VehicleType.FLATBED;
    if (/refrigerated|براد|مبرد/.test(lower)) filters.refrigerated = true;
    if (/container|حاو/.test(lower)) filters.containerTransport = true;
    if (/cross[- ]?border|حدود|gcc|دبي|dubai|uae|الإمارات/.test(lower)) filters.crossBorder = true;

    const cities = [
      { keys: ['muscat', 'مسقط'], governorateSearch: 'muscat' },
      { keys: ['salalah', 'صلالة', 'صلاله'], governorateSearch: 'salalah' },
      { keys: ['sohar', 'صحار'], governorateSearch: 'sohar' },
    ];
    for (const city of cities) {
      if (city.keys.some((k) => lower.includes(k))) {
        filters.search = `${filters.search} ${city.governorateSearch}`.trim();
      }
    }

    if (/available|متاح|غدا|tomorrow|available tomorrow/.test(lower)) {
      filters.availability = 'available';
    }

    return filters;
  }

  async search(query: string) {
    const filters = this.parseQuery(query);
    const results = await this.listings.browsePublic(filters as never);
    return { interpretedFilters: filters, ...results };
  }
}
