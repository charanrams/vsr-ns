import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { shopApi } from './api';
import { useShopAuth } from './auth';

// ------------------------------------------------------------------ Types (API shapes)
export interface Variant { _id: string; name: string; price: number; mrp?: number; stock: number; reserved?: number; isDefault?: boolean }
export interface Product {
  _id: string; name: string; unit?: string; price: number; mrp: number; images?: { url: string }[]; available: number; stockStatus?: string;
  brand?: string; description?: string; shortDescription?: string; rating?: number; reviewCount?: number; type?: string; badges?: string[];
  allergens?: string; category?: { _id: string; name: string } | string; sku?: string; returnable?: boolean; returnWindowDays?: number;
  deliveryType?: string; prepTimeMins?: number; variants?: Variant[]; status?: string;
}
export interface Category { _id: string; name: string; image?: string; description?: string; children?: Category[] }
export interface Banner { _id?: string; title: string; subtitle?: string; buttonText?: string; image: string; linkValue?: string }
export interface Review { _id?: string; customer?: { name?: string } | string; rating: number; text?: string; createdAt?: string }
export interface Totals { itemTotal: number; discount: number; couponCode?: string; deliveryFee: number; packagingFee: number; tax: number; grandTotal: number }
export interface LineItem {
  product: string; name: string; unit?: string; image?: string; unitPrice: number; mrp: number; quantity: number; lineTotal: number;
  available?: number; outOfStock?: boolean; previousPrice?: number; variant?: string; variantName?: string;
}
export interface Cart { items: LineItem[]; totals: Totals; warnings?: string[]; couponCode?: string; /** store rules: free delivery above this item total, else `fee` */ delivery?: { freeAbove: number; fee: number } }
export interface Address {
  _id: string; label: string; recipient: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string;
  postalCode: string; isDefault?: boolean; lat?: number; lng?: number;
}
export interface Order {
  _id: string; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; items: LineItem[]; totals: Totals; createdAt: string;
  address?: Address; history?: { to: string; at: string; reason?: string }[]; deliveryCode?: string;
  deliveryPartner?: { name: string; phone?: string; avatar?: string; rating?: number }; rating?: number; rejectionReason?: string;
}
export interface Notice { _id: string; title: string; body?: string; kind: string; read?: boolean; createdAt: string; /** e.g. /product/<id> for back-in-stock */ link?: string; /** order it's about: tapping opens it */ order?: string }
export interface Ticket { _id: string; ticketNumber: string; subject: string; status: string; createdAt: string }
export interface Coupon { _id: string; code: string; type: 'percent' | 'flat' | 'free_delivery'; value: number; minOrder: number; endDate?: string; description?: string }
export type HomeSectionKey = 'categories' | 'recommended' | 'deals' | 'bestSellers' | 'homemade' | 'recent' | 'category';
/** Rows, titles and order come from Admin → Home Screen (`sections`). */
export interface HomeData { banners: Banner[]; categories: Category[]; bestSellers: Product[]; homemade: Product[]; deals: Product[]; recommended?: Product[]; sections?: { key: HomeSectionKey; title: string; categoryId?: string; items?: Product[] }[] }
export type HomeRow = NonNullable<HomeData['sections']>[number];
export const DEFAULT_HOME_SECTIONS: HomeRow[] = [
  { key: 'categories', title: 'Shop by Category' },
  { key: 'recommended', title: 'Recommended for You' },
  { key: 'deals', title: 'Today’s Deals' },
  { key: 'bestSellers', title: 'Best Sellers' },
  { key: 'recent', title: 'Recently Viewed' },
];

// ------------------------------------------------------------------ Helpers
export const img = (p?: Product) => p?.images?.[0]?.url;
export const pct = (price: number, mrp: number) => (mrp > price && mrp > 0 ? Math.round((1 - price / mrp) * 100) : 0);
export const hasSizes = (p: Product) => (p.variants?.length ?? 0) > 0;
export const defaultVariant = (p: Product) => p.variants?.find((v) => v.isDefault) ?? p.variants?.[0];
export const vAvail = (v: Variant) => Math.max(0, v.stock - (v.reserved ?? 0));
export const outOfStock = (p: Product) => p.stockStatus === 'out_of_stock';
export const catName = (p: Product) => (typeof p.category === 'object' ? p.category?.name : undefined);
/** Short form for headers: area + city (skips flat numbers / map codes). Full address stays at checkout. */
export const shortLine = (a: Address) => [a.line2 || a.landmark, a.city].filter(Boolean).join(', ') || oneLine(a);
export const oneLine = (a: Address) => [a.line1, a.landmark, a.line2, `${a.city} - ${a.postalCode}`].filter(Boolean).join(', ');
export const isActiveOrder = (s: string) => ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivery_failed'].includes(s);
export const couponLabel = (c: Coupon) => (c.type === 'percent' ? `${c.value}% OFF` : c.type === 'flat' ? `₹${c.value} OFF` : 'FREE DELIVERY');
export const qtyOf = (cart: Cart | undefined, productId: string, variantId?: string) =>
  (cart?.items ?? []).filter((i) => i.product === productId && (!variantId || i.variant === variantId)).reduce((s, i) => s + i.quantity, 0);
export const cartCount = (cart?: Cart) => (cart?.items ?? []).reduce((s, i) => s + i.quantity, 0);

const k = (...parts: unknown[]) => ['shop', ...parts];
const get = async <T,>(url: string, params?: object) => (await shopApi.get<T>(url, { params })).data;

// ------------------------------------------------------------------ Catalogue (public)
export const useHome = () => useQuery({ queryKey: k('home'), queryFn: () => get<HomeData>('/store/home') });
export const useCategories = () => useQuery({ queryKey: k('categories'), queryFn: async () => (await get<{ categories: Category[] }>('/store/categories')).categories });
export interface ProductQuery { category?: string; q?: string; sort?: string; type?: string; minPrice?: number; maxPrice?: number; inStock?: boolean }
export const useProducts = (q: ProductQuery, enabled = true) =>
  useQuery({
    queryKey: k('products', q),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => (await get<{ items: Product[] }>('/store/products', { ...q, inStock: q.inStock ? 1 : undefined, limit: 60 })).items,
  });
export const useSearch = (q: ProductQuery) =>
  useQuery({
    queryKey: k('search', q),
    enabled: (q.q ?? '').trim().length >= 2,
    placeholderData: keepPreviousData,
    queryFn: async () => (await get<{ items: Product[] }>('/store/products', { ...q, inStock: q.inStock ? 1 : undefined, limit: 60 })).items,
  });
export const useDeals = () => useQuery({ queryKey: k('deals'), queryFn: async () => (await get<{ items: Product[] }>('/store/products', { sort: 'discount', limit: 30 })).items });
export const useProduct = (id: string) =>
  useQuery({ queryKey: k('product', id), queryFn: () => get<{ product: Product; reviews: Review[]; similar: Product[] }>(`/store/products/${id}`), retry: false });
export const useReviews = (id: string) =>
  useQuery({ queryKey: k('reviews', id), queryFn: () => get<{ items: Review[]; total: number; distribution: Record<string, number> }>(`/store/products/${id}/reviews`, { limit: 50 }) });
export const useConfig = () => useQuery({ queryKey: k('config'), queryFn: () => get<{ razorpayKeyId: string | null; paymentMethods: string[] }>('/store/config'), staleTime: 5 * 60_000 });

// ------------------------------------------------------------------ Customer (signed in)
function useSignedIn() {
  return Boolean(useShopAuth().user);
}
export const useCart = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('cart'), enabled: on, queryFn: () => get<Cart>('/store/me/cart') });
};
export const useAddresses = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('addresses'), enabled: on, queryFn: async () => (await get<{ addresses: Address[] }>('/store/me/addresses')).addresses });
};
export const useOrders = (tab: string) => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('orders', tab), enabled: on, queryFn: async () => (await get<{ orders: Order[] }>('/store/me/orders', { tab })).orders });
};
export const useOrder = (id: string) => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('order', id), enabled: on, queryFn: async () => (await get<{ order: Order }>(`/store/me/orders/${id}`)).order });
};
export const useNotifications = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('notifications'), enabled: on, queryFn: async () => (await get<{ items: Notice[] }>('/store/me/notifications')).items });
};
export const useWishlist = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('wishlist'), enabled: on, queryFn: async () => (await get<{ items: Product[] }>('/store/me/wishlist')).items });
};
export const useTickets = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('tickets'), enabled: on, queryFn: async () => (await get<{ tickets: Ticket[] }>('/store/me/tickets')).tickets });
};
/** Product ids the customer asked to be told about when back in stock ("Notify Me"). */
export const useStockAlerts = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('stock-alerts'), enabled: on, queryFn: async () => (await get<{ productIds: string[] }>('/store/me/stock-alerts')).productIds });
};
export const useCoupons = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('coupons'), enabled: on, queryFn: async () => (await get<{ coupons: Coupon[] }>('/store/me/coupons')).coupons });
};
export const useRecommendations = () => {
  const on = useSignedIn();
  return useQuery({ queryKey: k('recommended'), enabled: on, queryFn: async () => (await get<{ items: Product[] }>('/store/me/recommendations')).items });
};

/** Cart mutations: the server returns the freshly priced cart, which replaces the cached one. */
export function useCartActions() {
  const qc = useQueryClient();
  const put = (c: Cart) => qc.setQueryData(k('cart'), c);
  const setQty = useMutation({
    mutationFn: async (v: { productId: string; quantity: number; variantId?: string }) =>
      (await shopApi.put<Cart>('/store/me/cart/items', { productId: v.productId, quantity: v.quantity, ...(v.variantId ? { variantId: v.variantId } : {}) })).data,
    onSuccess: put,
  });
  const coupon = useMutation({ mutationFn: async (code: string | null) => (await shopApi.post<Cart>('/store/me/cart/coupon', { code })).data, onSuccess: put });
  const clear = useMutation({ mutationFn: async () => (await shopApi.delete<Cart>('/store/me/cart')).data, onSuccess: put });
  return { setQty, coupon, clear };
}

// ------------------------------------------------------------------ On-device lists (recent searches / recently viewed)
function useLocalList(key: string, max: number) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
    } catch {
      return [];
    }
  };
  const [list, setList] = useState<string[]>(read);
  useEffect(() => {
    const on = (e: StorageEvent) => e.key === key && setList(read());
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = (next: string[]) => {
    setList(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  return {
    list,
    add: (v: string) => save([v, ...read().filter((x) => x !== v)].slice(0, max)),
    remove: (v: string) => save(read().filter((x) => x !== v)),
    clear: () => save([]),
  };
}
export const useRecentSearches = () => useLocalList('vsr.shop.recentSearches', 8);
export const useRecentlyViewedIds = () => useLocalList('vsr.shop.recentlyViewed', 12);
export function useRecentlyViewed() {
  const { list } = useRecentlyViewedIds();
  return useQuery({
    queryKey: k('recent', list),
    queryFn: async () => {
      const out: Product[] = [];
      for (const id of list.slice(0, 10)) {
        try {
          out.push((await get<{ product: Product }>(`/store/products/${id}`)).product);
        } catch {
          /* removed product: skip */
        }
      }
      return out;
    },
  });
}
