import { lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import { Loading } from './components/ui';
import { RequireAuth, useAuth } from './lib/auth';
import { homeFor } from './lib/access';
import { RequireCustomer, ShopAuthProvider } from './shop/auth';
import ShopLayout, { ShopShell } from './shop/ShopLayout';
import ShopHome from './shop/pages/Home';
import { ForgotPasswordPage, LoginPage, NewPasswordPage, OtpPage, PasswordPage, PasswordUpdatedPage, SignUpPage } from './shop/pages/Auth';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const Products = lazy(() => import('./pages/Products'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const ProductReviews = lazy(() => import('./pages/ProductReviews'));
const Categories = lazy(() => import('./pages/Categories'));
const Inventory = lazy(() => import('./pages/Inventory'));
const InventoryHistory = lazy(() => import('./pages/InventoryHistory'));
const Customers = lazy(() => import('./pages/Customers'));
const DeliveryPartners = lazy(() => import('./pages/DeliveryPartners'));
const DeliveryOperations = lazy(() => import('./pages/DeliveryOperations'));
const Homemade = lazy(() => import('./pages/Homemade'));
const Marketing = lazy(() => import('./pages/Marketing'));
const HomeScreen = lazy(() => import('./pages/HomeScreen'));
const Payments = lazy(() => import('./pages/Payments'));
const Reports = lazy(() => import('./pages/Reports'));
const Support = lazy(() => import('./pages/Support'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));

// Storefront (customer) pages
const shop = {
  catalog: () => import('./shop/pages/Catalog'),
  product: () => import('./shop/pages/Product'),
  search: () => import('./shop/pages/Search'),
  checkout: () => import('./shop/pages/Checkout'),
  orders: () => import('./shop/pages/Orders'),
  account: () => import('./shop/pages/Account'),
  info: () => import('./shop/pages/Info'),
};
const CategoriesPage = lazy(() => shop.catalog().then((m) => ({ default: m.CategoriesPage })));
const ProductListPage = lazy(() => shop.catalog().then((m) => ({ default: m.ProductListPage })));
const DealsPage = lazy(() => shop.catalog().then((m) => ({ default: m.DealsPage })));
const CampaignPage = lazy(() => shop.catalog().then((m) => ({ default: m.CampaignPage })));
const RecommendedPage = lazy(() => shop.catalog().then((m) => ({ default: () => <m.CollectionPage kind="recommended" /> })));
const RecentPage = lazy(() => shop.catalog().then((m) => ({ default: () => <m.CollectionPage kind="recent" /> })));
const ProductPage = lazy(() => shop.product().then((m) => ({ default: m.ProductPage })));
const ReviewsPage = lazy(() => shop.product().then((m) => ({ default: m.ReviewsPage })));
const WriteReviewPage = lazy(() => shop.product().then((m) => ({ default: m.WriteReviewPage })));
const SearchPage = lazy(shop.search);
const CartPage = lazy(() => shop.checkout().then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => shop.checkout().then((m) => ({ default: m.CheckoutPage })));
const PaymentPage = lazy(() => shop.checkout().then((m) => ({ default: m.PaymentPage })));
const OrderPlacedPage = lazy(() => shop.checkout().then((m) => ({ default: m.OrderPlacedPage })));
const AddressFormPage = lazy(() => shop.checkout().then((m) => ({ default: m.AddressFormPage })));
const OrdersPage = lazy(() => shop.orders().then((m) => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => shop.orders().then((m) => ({ default: m.OrderDetailPage })));
const RateOrderPage = lazy(() => shop.orders().then((m) => ({ default: m.RateOrderPage })));
const AccountPage = lazy(() => shop.account().then((m) => ({ default: m.AccountPage })));
const EditProfilePage = lazy(() => shop.account().then((m) => ({ default: m.EditProfilePage })));
const AddressesPage = lazy(() => shop.account().then((m) => ({ default: m.AddressesPage })));
const WishlistPage = lazy(() => shop.account().then((m) => ({ default: m.WishlistPage })));
const CouponsPage = lazy(() => shop.account().then((m) => ({ default: m.CouponsPage })));
const NotificationsPage = lazy(() => shop.account().then((m) => ({ default: m.NotificationsPage })));
const NotificationDetailPage = lazy(() => shop.account().then((m) => ({ default: m.NotificationDetailPage })));
const HelpPage = lazy(() => shop.account().then((m) => ({ default: m.HelpPage })));
const ShopSettingsPage = lazy(() => shop.account().then((m) => ({ default: m.SettingsPage })));
const AboutPage = lazy(() => shop.info().then((m) => ({ default: m.AboutPage })));
const ContactPage = lazy(() => shop.info().then((m) => ({ default: m.ContactPage })));
const FaqPage = lazy(() => shop.info().then((m) => ({ default: m.FaqPage })));
const LegalPage = lazy(() => shop.info().then((m) => ({ default: m.LegalPage })));

/** Old admin bookmarks (before admin moved under /admin) keep working. */
const LEGACY_ADMIN = ['dashboard', 'orders', 'products', 'inventory', 'customers', 'delivery-partners', 'delivery-operations', 'homemade', 'marketing', 'payments', 'reports', 'support', 'settings'];
function LegacyAdmin() {
  const loc = useLocation();
  return <Navigate to={`/admin${loc.pathname}${loc.search}`} replace />;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.roles) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* ---------------- Admin portal (staff only; server refuses customer logins) ---------------- */}
      {/* One login for everyone: /login routes staff to /admin by role */}
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Suspense fallback={<Loading />}>
              <AdminLayout />
            </Suspense>
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="dashboard" element={<RequireAuth perm="dashboard"><S><Dashboard /></S></RequireAuth>} />
        <Route path="orders" element={<RequireAuth perm="orders"><S><Orders /></S></RequireAuth>} />
        <Route path="orders/:id" element={<RequireAuth perm="orders"><S><OrderDetails /></S></RequireAuth>} />
        <Route path="products" element={<RequireAuth perm="products"><S><Products /></S></RequireAuth>} />
        <Route path="products/new" element={<RequireAuth perm="products"><S><ProductForm /></S></RequireAuth>} />
        <Route path="products/:id/edit" element={<RequireAuth perm="products"><S><ProductForm /></S></RequireAuth>} />
        <Route path="products/reviews" element={<RequireAuth perm="products"><S><ProductReviews /></S></RequireAuth>} />
        <Route path="categories" element={<RequireAuth perm="categories"><S><Categories /></S></RequireAuth>} />
        <Route path="inventory" element={<RequireAuth perm="inventory"><S><Inventory /></S></RequireAuth>} />
        <Route path="inventory/history" element={<RequireAuth perm="inventory"><S><InventoryHistory /></S></RequireAuth>} />
        <Route path="customers" element={<RequireAuth perm="customers"><S><Customers /></S></RequireAuth>} />
        <Route path="delivery-partners" element={<RequireAuth perm="delivery"><S><DeliveryPartners /></S></RequireAuth>} />
        <Route path="delivery-operations" element={<RequireAuth perm="delivery"><S><DeliveryOperations /></S></RequireAuth>} />
        <Route path="homemade" element={<RequireAuth perm="homemade"><S><Homemade /></S></RequireAuth>} />
        <Route path="marketing" element={<RequireAuth perm="marketing"><S><Marketing /></S></RequireAuth>} />
        <Route path="home-screen" element={<RequireAuth perm="marketing"><S><HomeScreen /></S></RequireAuth>} />
        <Route path="payments" element={<RequireAuth perm="payments"><S><Payments /></S></RequireAuth>} />
        <Route path="reports" element={<RequireAuth perm="reports"><S><Reports /></S></RequireAuth>} />
        <Route path="support" element={<RequireAuth perm="support"><S><Support /></S></RequireAuth>} />
        <Route path="notifications" element={<RequireAuth perm="notifications"><S><Notifications /></S></RequireAuth>} />
        <Route path="settings" element={<RequireAuth perm="settings"><S><Settings /></S></RequireAuth>} />
        <Route path="*" element={<Home />} />
      </Route>
      {LEGACY_ADMIN.map((p) => (
        <Route key={p} path={`/${p}/*`} element={<LegacyAdmin />} />
      ))}

      {/* ---------------- Customer storefront + public pages (customers & guests) ---------------- */}
      <Route element={<ShopAuthProvider><Outlet /></ShopAuthProvider>}>
        {/* Sign-in screens: always light, like the app */}
        <Route path="/login" element={<div className="shop"><LoginPage /></div>} />
        <Route path="/login/password" element={<div className="shop"><PasswordPage /></div>} />
        <Route path="/login/otp" element={<div className="shop"><OtpPage /></div>} />
        <Route path="/login/new-password" element={<div className="shop"><NewPasswordPage /></div>} />
        <Route path="/login/password-updated" element={<div className="shop"><PasswordUpdatedPage /></div>} />
        {/* Old success-screen links just go Home */}
        <Route path="/login/success" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<div className="shop"><SignUpPage /></div>} />
        <Route path="/forgot-password" element={<div className="shop"><ForgotPasswordPage /></div>} />
        <Route element={<ShopShell><ShopLayout /></ShopShell>}>
          <Route index element={<ShopHome />} />
          <Route path="categories" element={<S><CategoriesPage /></S>} />
          <Route path="category/:id" element={<S><ProductListPage /></S>} />
          <Route path="products" element={<S><ProductListPage /></S>} />
          <Route path="product/:id" element={<S><ProductPage /></S>} />
          <Route path="product/:id/reviews" element={<S><ReviewsPage /></S>} />
          <Route path="product/:id/review" element={<RequireCustomer><S><WriteReviewPage /></S></RequireCustomer>} />
          <Route path="search" element={<S><SearchPage /></S>} />
          <Route path="deals" element={<S><DealsPage /></S>} />
          <Route path="campaign/:index" element={<S><CampaignPage /></S>} />
          <Route path="recommended" element={<S><RecommendedPage /></S>} />
          <Route path="recently-viewed" element={<S><RecentPage /></S>} />
          <Route path="cart" element={<RequireCustomer><S><CartPage /></S></RequireCustomer>} />
          <Route path="checkout" element={<RequireCustomer><S><CheckoutPage /></S></RequireCustomer>} />
          <Route path="checkout/payment" element={<RequireCustomer><S><PaymentPage /></S></RequireCustomer>} />
          <Route path="order-placed/:id" element={<RequireCustomer><S><OrderPlacedPage /></S></RequireCustomer>} />
          <Route path="account" element={<RequireCustomer><S><AccountPage /></S></RequireCustomer>} />
          <Route path="account/edit" element={<RequireCustomer><S><EditProfilePage /></S></RequireCustomer>} />
          <Route path="account/orders" element={<RequireCustomer><S><OrdersPage /></S></RequireCustomer>} />
          <Route path="account/orders/:id" element={<RequireCustomer><S><OrderDetailPage /></S></RequireCustomer>} />
          <Route path="account/orders/:id/rate" element={<RequireCustomer><S><RateOrderPage /></S></RequireCustomer>} />
          <Route path="account/addresses" element={<RequireCustomer><S><AddressesPage /></S></RequireCustomer>} />
          <Route path="account/addresses/new" element={<RequireCustomer><S><AddressFormPage /></S></RequireCustomer>} />
          <Route path="account/addresses/:id" element={<RequireCustomer><S><AddressFormPage /></S></RequireCustomer>} />
          <Route path="account/wishlist" element={<RequireCustomer><S><WishlistPage /></S></RequireCustomer>} />
          <Route path="account/coupons" element={<RequireCustomer><S><CouponsPage /></S></RequireCustomer>} />
          <Route path="account/notifications" element={<RequireCustomer><S><NotificationsPage /></S></RequireCustomer>} />
          <Route path="account/notifications/:id" element={<RequireCustomer><S><NotificationDetailPage /></S></RequireCustomer>} />
          <Route path="account/help" element={<RequireCustomer><S><HelpPage /></S></RequireCustomer>} />
          <Route path="account/settings" element={<S><ShopSettingsPage /></S>} />
          <Route path="about" element={<S><AboutPage /></S>} />
          <Route path="contact" element={<S><ContactPage /></S>} />
          <Route path="faq" element={<S><FaqPage /></S>} />
          {['terms', 'privacy', 'refund-policy', 'delivery-policy'].map((p) => (
            <Route key={p} path={p} element={<S><LegalPage /></S>} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function NotFound() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
      <p className="text-6xl font-extrabold text-brand-700">404</p>
      <h1 className="mt-4 text-xl font-extrabold">This page doesn’t exist</h1>
      <p className="mt-2 text-muted">The link may be old or mistyped.</p>
      <Link to="/" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-900 font-bold text-white">Go to the shop</Link>
    </div>
  );
}
