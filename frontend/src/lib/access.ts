import {
  LayoutDashboard, ShoppingBag, Package, LayoutList, Boxes, Users, Bike, Truck, ChefHat,
  Megaphone, CreditCard, BarChart3, LifeBuoy, Bell, Settings, type LucideIcon,
} from 'lucide-react';

export type Permission =
  | 'dashboard' | 'orders' | 'products' | 'categories' | 'inventory' | 'customers' | 'delivery'
  | 'homemade' | 'marketing' | 'payments' | 'reports' | 'support' | 'notifications' | 'settings' | 'users';

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  order_manager: 'Order Manager',
  catalogue_manager: 'Catalogue Manager',
  inventory_manager: 'Inventory Manager',
  finance_manager: 'Finance Manager',
  support_agent: 'Support Agent',
  customer: 'Customer',
};

/** Where each role lands after sign-in. Highest-privilege role wins. */
const ROLE_HOME: [string, string][] = [
  ['super_admin', '/admin/dashboard'],
  ['order_manager', '/admin/orders'],
  ['catalogue_manager', '/admin/products'],
  ['inventory_manager', '/admin/inventory'],
  ['finance_manager', '/admin/payments'],
  ['support_agent', '/admin/support'],
];
export function homeFor(roles: string[]) {
  return ROLE_HOME.find(([r]) => roles.includes(r))?.[1] ?? '/login';
}
export const primaryRole = (roles: string[]) => ROLE_HOME.find(([r]) => roles.includes(r))?.[0] ?? roles[0];

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  perm: Permission;
  badgeKey?: 'newOrders';
  children?: { label: string; to: string; countKey?: string }[];
}

export const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, perm: 'dashboard' },
  {
    label: 'Orders', to: '/admin/orders', icon: ShoppingBag, perm: 'orders', badgeKey: 'newOrders',
    children: [
      { label: 'All Orders', to: '/admin/orders' },
      { label: 'New Orders', to: '/admin/orders?status=placed', countKey: 'placed' },
      { label: 'Processing', to: '/admin/orders?status=processing', countKey: 'processing' },
      { label: 'Out for Delivery', to: '/admin/orders?status=out_for_delivery', countKey: 'out_for_delivery' },
      { label: 'Delivered', to: '/admin/orders?status=delivered' },
      { label: 'Cancelled', to: '/admin/orders?status=cancelled', countKey: 'cancelled' },
      { label: 'Return Requests', to: '/admin/orders?status=returns', countKey: 'returns' },
    ],
  },
  {
    label: 'Products', to: '/admin/products', icon: Package, perm: 'products',
    children: [
      { label: 'All Products', to: '/admin/products' },
      { label: 'Add Product', to: '/admin/products/new' },
      { label: 'Product Reviews', to: '/admin/products/reviews' },
    ],
  },
  { label: 'Categories', to: '/admin/categories', icon: LayoutList, perm: 'categories' },
  {
    label: 'Inventory', to: '/admin/inventory', icon: Boxes, perm: 'inventory',
    children: [
      { label: 'Stock Overview', to: '/admin/inventory' },
      { label: 'Low Stock', to: '/admin/inventory?stock=low_stock' },
      { label: 'Out of Stock', to: '/admin/inventory?stock=out_of_stock' },
      { label: 'Inventory History', to: '/admin/inventory/history' },
    ],
  },
  { label: 'Customers', to: '/admin/customers', icon: Users, perm: 'customers' },
  { label: 'Delivery Partners', to: '/admin/delivery-partners', icon: Bike, perm: 'delivery' },
  { label: 'Delivery Operations', to: '/admin/delivery-operations', icon: Truck, perm: 'delivery' },
  { label: 'Homemade Food', to: '/admin/homemade', icon: ChefHat, perm: 'homemade' },
  {
    label: 'Marketing', to: '/admin/marketing', icon: Megaphone, perm: 'marketing',
    children: [
      { label: 'Banners & Offers', to: '/admin/marketing' },
      { label: 'Home Screen', to: '/admin/home-screen' },
    ],
  },
  { label: 'Payments', to: '/admin/payments', icon: CreditCard, perm: 'payments' },
  { label: 'Reports', to: '/admin/reports', icon: BarChart3, perm: 'reports' },
  { label: 'Support & Returns', to: '/admin/support', icon: LifeBuoy, perm: 'support' },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell, perm: 'notifications' },
  { label: 'Settings', to: '/admin/settings', icon: Settings, perm: 'settings' },
];
