import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, features } from './config/env';
import { requestId, authenticate, requireStaff } from './middleware/auth';
import { errorHandler, notFound } from './utils/http';
import { corsOptions } from './config/cors';
import { verifyWebhookSignature } from './utils/services';
import { Payment, Order } from './models/Order';
import authRoutes from './routes/auth';
import storeRoutes from './routes/store';
import adminOrders from './routes/admin/orders';
import adminCatalog from './routes/admin/catalog';
import adminPeople from './routes/admin/people';
import adminBusiness from './routes/admin/business';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  // CORS policy: config/cors.ts (CORS_ORIGINS + localhost in dev + no-Origin clients like the mobile app)
  app.use(cors(corsOptions));
  app.use(requestId);
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Razorpay webhook needs the raw body for signature verification; idempotent by payment id
  app.post('/api/v1/webhooks/payments', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!features.razorpay || !env.RAZORPAY_WEBHOOK_SECRET) return res.status(404).end();
    const sig = req.header('x-razorpay-signature') ?? '';
    if (!verifyWebhookSignature(req.body as Buffer, sig)) return res.status(400).json({ error: 'invalid signature' });
    try {
      const evt = JSON.parse((req.body as Buffer).toString('utf8'));
      const entity = evt?.payload?.payment?.entity;
      if (entity?.order_id) {
        const payment = await Payment.findOne({ providerOrderId: entity.order_id });
        if (payment && payment.status !== 'paid' && payment.status !== 'refunded') {
          if (evt.event === 'payment.captured') {
            payment.status = 'paid';
            payment.providerPaymentId = entity.id;
            payment.verifiedAt = new Date();
            payment.logs.push({ event: 'Webhook: payment captured' });
            await Order.updateOne({ _id: payment.order }, { paymentStatus: 'paid' });
          } else if (evt.event === 'payment.failed') {
            payment.status = 'failed';
            payment.logs.push({ event: 'Webhook: payment failed' });
            await Order.updateOne({ _id: payment.order }, { paymentStatus: 'failed' });
          }
          await payment.save();
        }
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('[webhook]', e);
      res.status(500).json({ ok: false });
    }
  });

  app.use(express.json({ limit: '1mb' }));
  app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/store', storeRoutes);

  const admin = express.Router();
  admin.use(authenticate, requireStaff);
  admin.use('/orders', adminOrders);
  admin.use(adminCatalog);
  admin.use(adminPeople);
  admin.use(adminBusiness);
  app.use('/api/v1/admin', admin);

  app.use((_req, _res, next) => next(notFound('Route not found')));
  app.use(errorHandler);
  return app;
}
