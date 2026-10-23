const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = (n?: number | null) => inr.format(Math.round(n ?? 0));
export const num = (n?: number | null) => new Intl.NumberFormat('en-IN').format(n ?? 0);
export const date = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const time = (d?: string | Date | null) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
export const dateTime = (d?: string | Date | null) => (d ? `${date(d)}, ${time(d)}` : '—');
export function ago(d?: string | Date | null) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour${s >= 7200 ? 's' : ''} ago`;
  return `${Math.floor(s / 86400)} day${s >= 172800 ? 's' : ''} ago`;
}
export const title = (s?: string | null) => (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const shortK = (n: number) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}K` : `₹${n}`);
