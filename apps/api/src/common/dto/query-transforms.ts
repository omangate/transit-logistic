import { Transform, Type } from 'class-transformer';

/** Coerce query-string integers (e.g. ?page=1) for class-validator @IsInt(). */
export function QueryInt() {
  return Type(() => Number);
}

/** Coerce query-string decimals for class-validator @IsNumber(). */
export function QueryNumber() {
  return Type(() => Number);
}

/** Coerce query-string booleans (true/false/1/0). */
export function QueryBoolean() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  });
}
