import { Schema, model } from 'mongoose';
import { availableOf, Product } from '../models/Catalog';
import { Notification } from '../models/Ops';
import { User } from '../models/User';
import { sendMail } from './services';
import { env } from '../config/env';

/**
 * "Notify Me" for out-of-stock products. A customer asks once; when the product has stock again they get
 * an in-app notification (linked to the product) and an email, exactly once. Restocks are detected from
 * the database change stream (realtime.ts), so every path that adds stock is covered: admin edits,
 * inventory adjustments, cancelled orders releasing stock, imports.
 */
const stockAlertSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// One open request per customer + product
stockAlertSchema.index({ customer: 1, product: 1 }, { unique: true, partialFilterExpression: { notifiedAt: null } });
export const StockAlert = model('StockAlert', stockAlertSchema);

/** Called for every product change; cheap when nobody is waiting (one indexed count). */
export async function checkRestock(productId: string) {
  if (!(await StockAlert.exists({ product: productId, notifiedAt: null }))) return;
  const p = await Product.findById(productId);
  if (!p || p.status !== 'active' || availableOf(p) <= 0) return;
  const link = `/product/${productId}`;
  // Claim each alert atomically so two near-simultaneous stock updates can't notify twice
  for (;;) {
    const alert = await StockAlert.findOneAndUpdate({ product: productId, notifiedAt: null }, { notifiedAt: new Date() }, { new: true });
    if (!alert) break;
    await Notification.create({
      recipient: alert.customer,
      audience: 'user',
      kind: 'offer',
      title: `Back in stock: ${p.name}`,
      body: `${p.name} is available again. Order soon, before it runs out.`,
      link,
    });
    const user = await User.findById(alert.customer).select('email name');
    if (user?.email) {
      const url = `${env.CORS_ORIGINS.split(',')[0].trim()}${link}`;
      await sendMail(
        user.email,
        `Back in stock: ${p.name}`,
        `<p>Hi ${user.name ?? 'there'},</p><p><strong>${p.name}</strong> is back in stock on VSR.</p><p><a href="${url}">Order now</a> before it runs out.</p>`,
        url,
      );
    }
  }
}
