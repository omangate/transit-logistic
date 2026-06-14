import { createHash, randomBytes } from 'node:crypto';

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function addDurationToNow(duration: string): Date {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = Number.parseInt(match[1]!, 10);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';

  const multipliers: Record<'s' | 'm' | 'h' | 'd', number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
}
