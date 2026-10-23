/**
 * Customer tax invoice on an A4 page (prints, or "Save as PDF").
 * Mirrored in the app: mobile/lib/features/orders/invoice.dart.
 */
import { dateTime, money } from '../lib/format';
import { SUPPORT_PHONE } from './config';
import { oneLine, type Order } from './data';
import { LEGAL_ENTITY } from './legal';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function invoiceHtml(o: Order) {
  const t = o.totals;
  const row = (l: string, v: string, cls = '') => `<tr class="${cls}"><td>${esc(l)}</td><td class="r">${esc(v)}</td></tr>`;
  const items = o.items
    .map(
      (it, i) => `<tr>
        <td class="n">${i + 1}</td>
        <td>${esc(it.name)}${it.variantName || it.unit ? `<div class="m">${esc(it.variantName ?? it.unit)}</div>` : ''}</td>
        <td class="r">${it.quantity}</td>
        <td class="r">${esc(money(it.unitPrice))}</td>
        <td class="r b">${esc(money(it.lineTotal))}</td>
      </tr>`,
    )
    .join('');
  const count = o.items.reduce((s, i) => s + i.quantity, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(o.orderNumber)}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: #111; }
  body { font: 12px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 100%; max-width: 182mm; margin: 0 auto; }
  .r { text-align: right; white-space: nowrap; } .b { font-weight: 700; } .m { color: #555; font-size: 11px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; padding-bottom: 5mm; border-bottom: 2px solid #064e3b; }
  .org { display: flex; gap: 4mm; align-items: center; }
  .logo { width: 18mm; height: 18mm; object-fit: contain; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: .06em; color: #064e3b; }
  .tag { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #555; }
  .doc { text-align: right; }
  .doc h1 { margin: 0 0 2mm; font-size: 22px; letter-spacing: .12em; color: #064e3b; }
  .doc table td { padding: .5mm 0 .5mm 6mm; }
  .parties { display: flex; gap: 10mm; margin: 6mm 0; }
  .parties > div { flex: 1; }
  .label { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #555; margin-bottom: 1.5mm; }
  table { width: 100%; border-collapse: collapse; }
  .items th { padding: 2.5mm 2mm; background: #ecf5f1; color: #064e3b; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; text-align: left; }
  .items th.r { text-align: right; }
  .items td { padding: 2.5mm 2mm; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  .items .n { width: 8mm; color: #555; }
  .items tr { break-inside: avoid; }
  .sum { display: flex; justify-content: flex-end; margin-top: 5mm; break-inside: avoid; }
  .sum table { width: 80mm; } .sum td { padding: 1mm 0; }
  .total td { padding-top: 2.5mm; font-size: 15px; font-weight: 800; border-top: 2px solid #111; }
  footer { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #e3e3e3; text-align: center; font-size: 11px; color: #555; break-inside: avoid; }
  footer .b { color: #111; font-size: 12px; }
  @media screen { body { background: #f2f2f2; } .sheet { background: #fff; width: 210mm; max-width: 100%; min-height: 297mm; margin: 16px auto; padding: 14mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); } }
</style></head><body><div class="sheet">
  <header>
    <div>
      <div class="org">
        <img class="logo" src="${location.origin}/logo-mark.png" alt="">
        <div><div class="brand">${esc(LEGAL_ENTITY.name || 'VSR')}</div><div class="tag">Shop · Eat · Live Better</div></div>
      </div>
      ${LEGAL_ENTITY.address ? `<div class="m" style="margin-top:2mm">${esc(LEGAL_ENTITY.address)}</div>` : ''}
      ${LEGAL_ENTITY.gstin ? `<div class="m">GSTIN: ${esc(LEGAL_ENTITY.gstin)}</div>` : ''}
    </div>
    <div class="doc">
      <h1>TAX INVOICE</h1>
      <table>
        ${row('Invoice no.', o.orderNumber)}
        ${row('Date', dateTime(o.createdAt))}
        ${row('Payment', o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase())}
      </table>
    </div>
  </header>
  ${o.address ? `<div class="parties"><div><div class="label">Bill to</div><div class="b">${esc(o.address.recipient)}</div><div>${esc(o.address.phone)}</div><div class="m">${esc(oneLine(o.address))}</div></div></div>` : '<div style="height:6mm"></div>'}
  <table class="items">
    <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="sum"><table>
    ${row(`Item total (${count} item${count === 1 ? '' : 's'})`, money(t.itemTotal))}
    ${t.discount > 0 ? row(`Discount${t.couponCode ? ` (${t.couponCode})` : ''}`, `−${money(t.discount)}`) : ''}
    ${row('Delivery fee', t.deliveryFee === 0 ? 'FREE' : money(t.deliveryFee))}
    ${row('Packaging fee', money(t.packagingFee))}
    ${row('GST (included)', money(t.tax))}
    ${row('TOTAL', money(t.grandTotal), 'total')}
  </table></div>
  <footer><div class="b">Thank you for shopping with us!</div>${SUPPORT_PHONE ? `<div>Help: ${esc(SUPPORT_PHONE)}</div>` : ''}<div>Prices inclusive of all taxes. This is a computer-generated invoice.</div></footer>
</div>
  <script>window.onload = () => { const i = document.images[0]; const go = () => setTimeout(() => window.print(), 50); i && !i.complete ? (i.onload = i.onerror = go) : go(); };</script>
</body></html>`;
}

/** Opens the invoice in a new tab and starts printing (A4 printer, or "Save as PDF"). */
export function printInvoice(o: Order) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(invoiceHtml(o));
  w.document.close();
  return true;
}
