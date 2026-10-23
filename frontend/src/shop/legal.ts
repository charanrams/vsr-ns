/**
 * Public policy content for the storefront (and mirrored in the mobile app: lib/core/legal.dart).
 * Written from how the product actually works. Have it reviewed by your legal advisor before launch,
 * and add the registered business name, address and GSTIN where marked in LEGAL_ENTITY.
 */
import { SUPPORT_EMAIL, SUPPORT_PHONE } from './config';

export const LEGAL_UPDATED = '23 October 2026';
/** Fill in before launch (shown on Terms, Privacy and Contact). */
export const LEGAL_ENTITY = { name: 'VSR', address: '', gstin: '' };

export interface Section {
  heading: string;
  body?: string[];
  bullets?: string[];
}
export interface Doc {
  slug: string;
  title: string;
  intro: string;
  sections: Section[];
}

export const TERMS: Doc = {
  slug: 'terms',
  title: 'Terms & Conditions',
  intro: `These terms apply when you browse or buy on VSR through our website or mobile app. By creating an account or placing an order, you agree to them.`,
  sections: [
    { heading: 'Your account', bullets: ['You must give accurate details (name, email, mobile number) and keep them up to date.', 'Keep your password and one-time codes private. You are responsible for activity on your account.', 'We may suspend accounts used for fraud, abuse of offers, or harm to other customers, partners or staff.'] },
    { heading: 'Products, prices and availability', bullets: ['Prices are shown in Indian Rupees and include GST unless stated otherwise.', 'Product photos are representative. Fresh produce and homemade food can vary naturally in size, colour and weight.', 'Prices and stock can change. They are confirmed again when you place your order, and your cart tells you if anything changed.'] },
    { heading: 'Orders and confirmation', bullets: ['Placing an order is an offer to buy. Every order is reviewed by VSR, which checks stock and payment before confirming it.', 'We may decline an order, for example if an item is unavailable, the address is outside our delivery area, or the payment cannot be verified. If you already paid, the amount is refunded (see Refunds & Cancellations).', 'You will be notified when your order is confirmed, prepared, out for delivery and delivered.'] },
    { heading: 'Payments', bullets: ['You can pay online (UPI, cards, net banking, wallets) through Razorpay, or by cash on delivery where available.', 'Online payments are processed by Razorpay. VSR does not see or store your full card details.', 'An order is treated as paid only after the payment provider confirms it.'] },
    { heading: 'Delivery', bullets: ['We deliver to serviceable PIN codes only. You can check your PIN when adding an address.', 'When your order is out for delivery, you get a 6-digit delivery code. Share it only with the delivery partner at your door; it confirms that you received the order.', 'Delivery times are estimates and can be affected by weather, traffic or high demand.'] },
    { heading: 'Cancellations, returns and refunds', body: ['These are covered by our Refunds & Cancellations policy, which forms part of these terms.'] },
    { heading: 'Coupons and offers', bullets: ['Coupons have their own conditions such as a minimum order value, validity dates and usage limits, shown with the coupon.', 'Only one coupon can be applied per order. Coupons have no cash value.'] },
    { heading: 'Reviews', bullets: ['Only customers who received a product can review it.', 'Reviews must be honest and must not contain personal details, abuse or advertising. We may remove reviews that break these rules.'] },
    { heading: 'Homemade food', bullets: ['Homemade items are prepared by independent home kitchens listed on VSR. Ingredients and allergen information are shown when the kitchen provides them.', 'If you have an allergy, read the product details carefully and contact support before ordering if you are unsure.'] },
    { heading: 'Liability', body: ['We take reasonable care to deliver correct, good-quality products on time. To the extent permitted by law, our liability for an order is limited to the amount you paid for it. Nothing in these terms limits rights you have under consumer protection law.'] },
    { heading: 'Changes and governing law', body: ['We may update these terms; the date at the top shows the latest version. These terms are governed by the laws of India, and courts in Hyderabad, Telangana have jurisdiction.'] },
    { heading: 'Contact', body: [`Questions about these terms: ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}.`] },
  ],
};

export const PRIVACY: Doc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  intro: `This policy explains what personal data VSR collects, why, and the choices you have. We collect only what we need to deliver your orders.`,
  sections: [
    { heading: 'What we collect', bullets: ['Account details: name, email address, mobile number and password (stored only as a secure hash).', 'Delivery addresses you save, including map coordinates if you pick a location on the map.', 'Orders, payments status, cart, wishlist, reviews and support tickets.', 'Your location, only when you choose “Use my current location”, to find your address. Location access is always optional.', 'Basic technical data needed to keep you signed in securely (session tokens and device type).'] },
    { heading: 'What we don’t collect', bullets: ['Full card numbers, CVV or UPI PINs. Online payments are handled by Razorpay.', 'Your location in the background. We never use location for advertising.'] },
    { heading: 'How we use it', bullets: ['To create your account, verify your email or phone, and sign you in.', 'To process, deliver and support your orders, including sharing your name, phone and address with the delivery partner for your order.', 'To send order updates and, where you allow it, offers and notifications.', 'To prevent fraud and misuse, and to meet legal and tax obligations.'] },
    { heading: 'Who we share it with', bullets: ['Delivery partners: only the details needed to deliver your order.', 'Razorpay: to process online payments.', 'Service providers that host our systems, images and email delivery, under confidentiality obligations.', 'Authorities, when required by law.', 'We do not sell your personal data.'] },
    { heading: 'How long we keep it', body: ['We keep your account data while your account is active. Order and payment records are kept as long as tax and accounting law requires, even after account deletion.'] },
    { heading: 'Your choices and rights', bullets: ['View and edit your profile and addresses in your account.', 'Turn notifications and location access on or off in your phone or browser settings.', 'Request deletion of your account and personal data from Settings & legal → Request account deletion, or by emailing us.', 'Ask what data we hold about you or request a correction by contacting us.'] },
    { heading: 'Security', body: ['Data is sent over encrypted connections. Passwords are hashed, sessions expire and can be revoked, and staff access is limited by role and logged.'] },
    { heading: 'Children', body: ['VSR is not intended for children under 18. Orders must be placed by an adult.'] },
    { heading: 'Contact and grievances', body: [`For privacy questions, data requests or grievances, contact ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}.`] },
  ],
};

export const REFUNDS: Doc = {
  slug: 'refund-policy',
  title: 'Refunds & Cancellations',
  intro: `How cancelling, returning and getting your money back works on VSR.`,
  sections: [
    { heading: 'Cancelling an order', bullets: ['You can cancel an order yourself from Order details while it is still “Placed”, before VSR confirms it.', 'Once an order is confirmed and being prepared, contact support. We’ll help if the order hasn’t left for delivery yet.'] },
    { heading: 'Orders declined by VSR', body: ['If we cannot fulfil an order (for example, an item is out of stock or payment could not be verified), we cancel it and tell you why. Any amount already paid is refunded in full.'] },
    { heading: 'Returns', bullets: ['Each product page shows whether it is returnable and the return window (usually within 2 days of delivery).', 'Damaged, wrong or missing items can be reported from Order details or Help & support, with photos where possible.', 'Homemade food and perishable items are not returnable for change of mind, but you can always report quality problems to support.'] },
    { heading: 'Refunds', bullets: ['Online payments are refunded to the original payment method once the payment provider processes the refund.', 'Cash on delivery refunds are settled by bank transfer to the account you share with support.', 'You can see the refund status on Order details. We only mark a refund complete after the provider confirms it.'] },
    { heading: 'Need help?', body: [`Contact ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}, or raise a ticket from Help & support.`] },
  ],
};

export const DELIVERY: Doc = {
  slug: 'delivery-policy',
  title: 'Delivery Policy',
  intro: `Where we deliver, what it costs, and how handover works.`,
  sections: [
    { heading: 'Where we deliver', body: ['We deliver to serviceable PIN codes in and around Hyderabad. Add your address and we’ll tell you straight away if we deliver there.'] },
    { heading: 'Charges', body: ['Any delivery and packaging fee is shown in your cart and on the bill before you pay. Some orders and coupons qualify for free delivery.'] },
    { heading: 'Timing', bullets: ['Orders are confirmed after stock and payment checks, usually within minutes.', 'You can follow every step (confirmed, preparing, packed, out for delivery, delivered) on Order details.', 'Homemade food shows its preparation time on the product page.'] },
    { heading: 'Handover', bullets: ['Your delivery partner’s name and contact appear once your order is out for delivery.', 'Share the 6-digit delivery code only when you receive your order. It confirms the handover.', 'If delivery can’t be completed, the order is marked “Delivery failed” on Order details and our team will contact you.'] },
  ],
};

export const FAQS: [string, string][] = [
  ['When will my order be confirmed?', 'VSR checks stock and payment for every order, usually within a few minutes. You’ll get a notification once it is confirmed.'],
  ['Which areas do you deliver to?', 'Serviceable PIN codes in and around Hyderabad. Add your address and we’ll check it instantly.'],
  ['What is the delivery code?', 'When your order is out for delivery, a 6-digit code appears on the order screen. Share it only with the delivery partner at your door.'],
  ['How can I pay?', 'UPI, cards, net banking and wallets through Razorpay, or cash on delivery where available.'],
  ['Can I cancel my order?', 'Yes, from Order details while it is still “Placed”. After that, contact support and we’ll help if it hasn’t left for delivery.'],
  ['How do refunds work?', 'Refunds go back to your original payment method after the payment provider confirms them. COD refunds are settled by bank transfer.'],
  ['Who makes the homemade food?', 'Independent home kitchens listed on VSR. Each dish shows its preparation time and, when provided, ingredients and allergens.'],
  ['How do I delete my account?', 'Go to Settings & legal → Request account deletion. Our team confirms by email.'],
];

export const DOCS: Record<string, Doc> = { terms: TERMS, privacy: PRIVACY, 'refund-policy': REFUNDS, 'delivery-policy': DELIVERY };
