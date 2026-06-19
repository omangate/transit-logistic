import type { SupportedLocale } from '@transit-logistic/shared';
import { UserRole } from '@transit-logistic/shared';

/** Application user entity — mirrors `User` in prisma/schema.prisma */
export interface User {
  id: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: UserRole;
  locale: SupportedLocale;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
