import { OceanCarrierCode, OceanTrackingSearchType } from '@transit-logistic/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { OceanCarriersService } from './ocean-carriers.service';
import type { ScheduleSearchInput, TrackOceanInput } from './ocean-carrier.types';

@Controller('ocean')
export class OceanCarriersController {
  constructor(private readonly oceanCarriersService: OceanCarriersService) {}

  @Get('carriers')
  listCarriers() {
    return this.oceanCarriersService.listCarrierDirectory();
  }

  @Get('track')
  track(
    @Query('type') type: string,
    @Query('value') value: string,
    @Query('carrier') carrier?: OceanCarrierCode,
  ) {
    const searchType = this.parseSearchType(type);
    const input: TrackOceanInput = {
      searchType,
      searchValue: value,
      carrierCode: carrier,
    };
    return this.oceanCarriersService.track(input);
  }

  @Post('track')
  trackPost(@Body() body: TrackOceanInput) {
    return this.oceanCarriersService.track(body);
  }

  @Get('schedules')
  searchSchedules(
    @Query('origin') originUnlocode: string,
    @Query('destination') destinationUnlocode: string,
    @Query('departureDate') departureDate?: string,
    @Query('containerType') containerType?: string,
    @Query('directOnly') directOnly?: string,
    @Query('carrier') carrierCode?: OceanCarrierCode,
  ) {
    const input: ScheduleSearchInput = {
      originUnlocode,
      destinationUnlocode,
      departureDate,
      containerType,
      directOnly: directOnly === 'true',
      carrierCode,
    };
    return this.oceanCarriersService.searchSchedules(input);
  }

  private parseSearchType(type: string): OceanTrackingSearchType {
    switch (type) {
      case OceanTrackingSearchType.CONTAINER:
      case OceanTrackingSearchType.BILL_OF_LADING:
      case OceanTrackingSearchType.BOOKING:
      case OceanTrackingSearchType.REFERENCE:
        return type;
      default:
        return OceanTrackingSearchType.REFERENCE;
    }
  }
}
