import {
  generateShipmentReference,
  getMaxReferenceAttempts,
  isShipmentReferenceCollision,
} from './shipment-reference.util';

describe('shipment-reference.util', () => {
  it('generates a reference with the expected format', () => {
    const reference = generateShipmentReference(new Date('2026-06-07T12:00:00.000Z'));

    expect(reference).toMatch(/^TL-20260607-\d{5}$/);
  });

  it('detects shipment reference unique collisions', () => {
    expect(
      isShipmentReferenceCollision({
        code: 'P2002',
        meta: { target: ['reference_number'] },
      }),
    ).toBe(true);

    expect(isShipmentReferenceCollision({ code: 'P2002', meta: { target: ['email'] } })).toBe(
      false,
    );
  });

  it('exposes a bounded retry count', () => {
    expect(getMaxReferenceAttempts()).toBeGreaterThan(0);
  });
});
