import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5050),
  MONGO_URI: z.string().optional().default(''),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(7),
  OTP_TTL_MINUTES: z.coerce.number().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('VSR <no-reply@vsr.in>'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@123'),
  // Mobile app gates (semver). Below MIN -> update required; below LATEST -> optional prompt.
  APP_MIN_VERSION: z.string().default('1.0.0'),
  APP_LATEST_VERSION: z.string().default('1.0.0'),
  APP_UNSUPPORTED_BELOW: z.string().default('0.0.0'),
  MAINTENANCE_MODE: z.enum(['true', 'false']).default('false'),
  MAINTENANCE_MESSAGE: z.string().default('We are upgrading VSR to serve you better. Please check back shortly.'),
  // Comma-separated serviceable PIN codes / prefixes; empty = everywhere
  SERVICE_PINCODES: z.string().default('5000'),
  // Push notifications (Firebase Cloud Messaging). Local: path to the service-account JSON.
  // Hosting: paste the JSON (or its base64) into FIREBASE_SERVICE_ACCOUNT_JSON instead.
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional().default(''),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  // Browser push: the Firebase *web app* config + VAPID key. Served to the website by GET /store/config,
  // so the frontend needs no Firebase settings of its own.
  FIREBASE_WEB_API_KEY: z.string().optional().default(''),
  FIREBASE_WEB_APP_ID: z.string().optional().default(''),
  FIREBASE_AUTH_DOMAIN: z.string().optional().default(''),
  FIREBASE_PROJECT_ID: z.string().optional().default(''),
  FIREBASE_MESSAGING_SENDER_ID: z.string().optional().default(''),
  FIREBASE_VAPID_KEY: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
if (isProd && !env.MONGO_URI) {
  console.error('MONGO_URI is required in production');
  process.exit(1);
}
export const features = {
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  smtp: Boolean(env.SMTP_HOST),
  webPush: Boolean(env.FIREBASE_WEB_API_KEY && env.FIREBASE_WEB_APP_ID && env.FIREBASE_PROJECT_ID && env.FIREBASE_MESSAGING_SENDER_ID && env.FIREBASE_VAPID_KEY),
};
