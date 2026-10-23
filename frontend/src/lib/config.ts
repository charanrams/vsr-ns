/**
 * Backend address for every page, API call and live-update socket (admin + storefront).
 * Set VITE_API_URL in frontend/.env (e.g. http://localhost:5050 or https://api.vsr.in).
 * Empty = same origin as the website (the Vite dev proxy / a reverse proxy forwards /api and /socket.io).
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
export const API_BASE = `${API_ORIGIN}/api/v1`;
