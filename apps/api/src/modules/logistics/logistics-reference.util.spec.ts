import { generateLogisticsReference } from './logistics-reference.util';

describe('generateLogisticsReference', () => {
  it('uses the provided prefix', () => {
    const ref = generateLogisticsReference('CC');
    expect(ref.startsWith('CC-')).toBe(true);
  });

  it('generates unique values', () => {
    const a = generateLogisticsReference('LO');
    const b = generateLogisticsReference('LO');
    expect(a).not.toBe(b);
  });
});
