import nodemailer from 'nodemailer';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env, features, isProd } from '../config/env';
import { AuditLog, Notification } from '../models/Ops';
import type { Request } from 'express';

// ---------- Email (Nodemailer) ----------
const transporter = features.smtp
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail(to: string, subject: string, html: string, devPreview?: string) {
  if (!transporter) {
    if (!isProd) console.log(`[mail:dev] to=${to} subject="${subject}" ${devPreview ?? ''}`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html });
  } catch (e) {
    console.error('[mail] delivery failed', (e as Error).message);
  }
}

export function otpEmail(code: string, purpose: string) {
  return `<div style="font-family:Arial,sans-serif;color:#202923">
    <h2 style="color:#064E3B">VSR — Shop · Eat · Live Better</h2>
    <p>Your one-time code to ${purpose} is:</p>
    <p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#064E3B">${code}</p>
    <p>It expires in ${env.OTP_TTL_MINUTES} minutes. Never share this code with anyone.</p></div>`;
}

// ---------- Razorpay ----------
export const razorpay = features.razorpay
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}
export function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b || '');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// ---------- Cloudinary ----------
if (features.cloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}
export function uploadImage(buffer: Buffer, folder: string): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: `vsr/${folder}`, resource_type: 'image' }, (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      })
      .end(buffer);
  });
}

// ---------- Audit + notifications ----------
export async function audit(req: Request, action: string, resourceType: string, resourceId: string, summary?: string) {
  await AuditLog.create({ actor: req.user?.id, action, resourceType, resourceId, summary, requestId: req.id });
}

export async function notify(recipient: string | null, title: string, body: string, kind: 'order' | 'offer' | 'system' = 'order') {
  await Notification.create({ recipient, audience: recipient ? 'user' : 'all_customers', title, body, kind });
}
