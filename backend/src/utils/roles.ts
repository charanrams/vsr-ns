export const STAFF_ROLES = [
  'super_admin',
  'order_manager',
  'catalogue_manager',
  'inventory_manager',
  'finance_manager',
  'support_agent',
] as const;
export const ROLES = [...STAFF_ROLES, 'customer', 'delivery_partner'] as const;
export type Role = (typeof ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  'dashboard',
  'orders',
  'products',
  'categories',
  'inventory',
  'customers',
  'delivery',
  'homemade',
  'marketing',
  'payments',
  'reports',
  'support',
  'notifications',
  'settings',
  'users',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Least-privilege permission map (PRD §4). Super admin has everything. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  order_manager: ['dashboard', 'orders', 'customers', 'delivery', 'notifications'],
  catalogue_manager: ['dashboard', 'products', 'categories', 'homemade', 'marketing'],
  inventory_manager: ['dashboard', 'inventory', 'products'],
  finance_manager: ['dashboard', 'payments', 'reports', 'orders'],
  support_agent: ['dashboard', 'support', 'customers', 'orders'],
  customer: [],
  delivery_partner: [],
};

export function permissionsFor(roles: Role[]): Permission[] {
  return [...new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []))];
}

export const isStaff = (roles: Role[]) => roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
