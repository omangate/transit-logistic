import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, validate } from 'class-validator';
import 'reflect-metadata';

import { QueryBoolean, QueryInt } from '../../common/dto/query-transforms';

class PaginationQueryDto {
  @QueryInt()
  @IsOptional()
  @IsInt()
  page?: number;

  @QueryInt()
  @IsOptional()
  @IsInt()
  limit?: number;
}

class FeaturedQueryDto {
  @QueryBoolean()
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

describe('MarketplaceBrowseQueryDto transforms', () => {
  it('coerces page and limit query strings', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '1', limit: '5' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(5);
  });

  it('coerces boolean query strings', async () => {
    const dto = plainToInstance(FeaturedQueryDto, { featured: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.featured).toBe(true);
  });
});
