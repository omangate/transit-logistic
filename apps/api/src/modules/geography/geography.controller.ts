import { Controller, Get, Param, Query } from '@nestjs/common';
import type { GeoRegionType } from '@prisma/client';

import { Public } from '../../common/decorators/public.decorator';

import { GeographyService } from './geography.service';

@Controller('geography')
@Public()
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get('countries')
  listCountries() {
    return this.geography.listCountries();
  }

  @Get('countries/:code')
  getCountry(@Param('code') code: string) {
    return this.geography.getCountry(code.toUpperCase());
  }

  @Get('countries/:code/governorates')
  listGovernorates(@Param('code') code: string) {
    return this.geography.listGovernorates(code.toUpperCase());
  }

  @Get('countries/:code/regions')
  listRegions(
    @Param('code') code: string,
    @Query('type') type?: GeoRegionType,
    @Query('parentId') parentId?: string,
    @Query('governorateId') governorateId?: string,
  ) {
    return this.geography.listRegions({
      countryCode: code.toUpperCase(),
      type,
      parentId,
      governorateId,
    });
  }

  @Get('countries/:code/search')
  search(
    @Param('code') code: string,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.geography.searchRegions(code.toUpperCase(), q, limit ? Number(limit) : 20);
  }

  @Get('regions/:id')
  getRegion(@Param('id') id: string) {
    return this.geography.getRegion(id);
  }
}
