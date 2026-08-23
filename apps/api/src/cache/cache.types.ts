/** Minimal Redis-compatible cache interface used by tracking + email throttling. */
export interface CacheLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  ping(): Promise<'PONG'>;
}
