const MAX_REFERENCE_ATTEMPTS = 5;

export function generateShipmentReference(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');

  return `TL-${year}${month}${day}-${suffix}`;
}

export function isShipmentReferenceCollision(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code: string }).code !== 'P2002'
  ) {
    return false;
  }

  const meta = (error as { meta?: { target?: string[] } }).meta;
  return meta?.target?.includes('reference_number') ?? false;
}

export function getMaxReferenceAttempts(): number {
  return MAX_REFERENCE_ATTEMPTS;
}
