import type { Server as HttpServer } from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { isAllowedOrigin } from './config/cors';
import { isStaff, type Role } from './utils/roles';
import { verifyAccess } from './utils/security';
import { checkRestock } from './utils/restock';

/**
 * Realtime sync: one MongoDB change stream → Socket.IO "change" signals ({ coll, op, id }).
 * No document data is sent; clients refetch through the authorised REST API. See docs/realtime-sync.md.
 */

// Visible to everyone (catalogue). Guests included.
const PUBLIC = new Set(['products', 'categories', 'banners', 'coupons', 'reviews', 'homelayouts']);
// Belong to one customer: the field holding their user id.
const OWNED: Record<string, string> = { stockalerts: 'customer', orders: 'customer', payments: 'customer', carts: 'customer', supporttickets: 'customer', notifications: 'recipient', users: '_id' };
// Internal bookkeeping nobody displays.
const IGNORED = new Set(['sessions', 'otps', 'counters']);

export function attachRealtime(http: HttpServer) {
  const io = new Server(http, {
    // Same allow-list as the REST API (config/cors.ts)
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), methods: ['GET', 'POST'] },
    // Mobile networks drop idle sockets; ping often enough to notice and reconnect
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  io.on('connection', (socket) => {
    socket.join('public');
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return;
    try {
      const claims = verifyAccess(token);
      socket.join(`user:${claims.sub}`);
      if (isStaff(claims.roles as Role[])) socket.join('staff');
      else socket.join('customers');
    } catch {
      // Expired/invalid token: stay a guest; the client reconnects with a fresh token after refresh
      socket.emit('auth_error');
    }
  });

  watchDatabase(io);
  return io;
}

function watchDatabase(io: Server) {
  const db = mongoose.connection.db;
  if (!db) return;
  let stream: ReturnType<typeof db.watch>;
  try {
    // updateLookup gives the current document on updates, so we can route owned docs to their owner
    stream = db.watch([], { fullDocument: 'updateLookup' });
  } catch (e) {
    console.warn('[realtime] change streams unavailable — live updates disabled:', (e as Error).message);
    return;
  }
  stream.on('change', (ev) => {
    if (!('ns' in ev) || !ev.ns || !('coll' in ev.ns)) return;
    const coll = ev.ns.coll as string;
    if (IGNORED.has(coll)) return;
    // Back-in-stock alerts: any product write may have added stock
    if (coll === 'products' && 'documentKey' in ev) {
      checkRestock(String((ev.documentKey as { _id: unknown })._id)).catch((e) => console.warn('[restock]', (e as Error).message));
    }
    const id = 'documentKey' in ev ? String((ev.documentKey as { _id: unknown })._id) : undefined;
    const payload = { coll, op: ev.operationType, id };
    const rooms = new Set<string>(['staff']);
    if (PUBLIC.has(coll)) rooms.add('public');
    const owner = OWNED[coll];
    const doc = 'fullDocument' in ev ? (ev.fullDocument as Record<string, unknown> | null | undefined) : undefined;
    if (owner && doc) {
      if (coll === 'notifications' && doc.audience === 'all_customers') rooms.add('customers');
      else if (doc[owner]) rooms.add(`user:${String(doc[owner])}`);
    }
    io.to([...rooms]).emit('change', payload);
  });
  stream.on('error', (e) => {
    // Standalone mongod (no replica set) lands here; the API keeps working without live updates
    console.warn('[realtime] change stream stopped — live updates disabled:', e.message);
  });
  console.log('[realtime] live updates on (change stream + Socket.IO)');
}
