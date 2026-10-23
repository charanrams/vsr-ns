import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth';
import { startRealtime } from './lib/realtime';
import { startShopRealtime } from './shop/realtime';
import { startWebPush } from './lib/push';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (n, e) => n < 1 && (e as { response?: { status?: number } })?.response?.status !== 403, refetchOnWindowFocus: false },
  },
});

// Live updates: database changes refresh the matching queries on every open page
startRealtime(queryClient);
startShopRealtime(queryClient);
// Browser push: keep this browser's registration linked to the signed-in account
startWebPush();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          {/* Phones: sit just above the floating bottom tabs (~76px tall incl. gap) */}
          <Toaster position="bottom-center" richColors closeButton duration={2000} mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }} />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
