import { calculateRentalPricing, countRentalDays } from './rental-pricing.util';

describe('rental-pricing.util', () => {
  it('counts inclusive rental days', () => {
    const start = new Date('2026-06-01T00:00:00.000Z');
    const end = new Date('2026-06-03T00:00:00.000Z');
    expect(countRentalDays(start, end)).toBe(3);
  });

  it('calculates daily rental total', () => {
    const result = calculateRentalPricing(
      { dailyRentalPrice: { toString: () => '10' } as never, weeklyRentalPrice: null, monthlyRentalPrice: null, minRentalDays: 1 },
      new Date('2026-06-01'),
      new Date('2026-06-05'),
    );
    expect(result.rentalDays).toBe(5);
    expect(result.totalAmount).toBe('50.000');
    expect(result.currency).toBe('OMR');
  });
});
