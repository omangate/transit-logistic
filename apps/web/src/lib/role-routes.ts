import { UserRole } from '@transit-logistic/shared';

export function getRoleHomePath(role: string): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin/dashboard';
    case UserRole.FLEET_OWNER:
      return '/fleet/dashboard';
    case UserRole.DRIVER:
      return '/driver/dashboard';
    case UserRole.CUSTOMER:
    default:
      return '/dashboard';
  }
}

export function getRoleLogisticsPath(role: string): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin/logistics';
    case UserRole.FLEET_OWNER:
      return '/fleet/logistics';
    case UserRole.CUSTOMER:
      return '/logistics';
    default:
      return getRoleHomePath(role);
  }
}
