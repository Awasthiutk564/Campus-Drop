import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, serverTimestamp } from 'firebase/database';

// Same database the website and the ESP8266 box use (see ../../firebase-config.js).
const config = {
  databaseURL: 'https://campusdrop-80526-default-rtdb.firebaseio.com',
  projectId: 'campusdrop-80526',
};

const db = getDatabase(initializeApp(config));

export const HEARTBEAT_STALE_MS = 30000;

export const BOXES = [
  { id: 'B01', no: '01', name: 'Smart Box 01', place: 'Hostel A, main gate', real: true },
  { id: 'B02', no: '02', name: 'Smart Box 02', place: 'Central library entrance' },
  { id: 'B03', no: '03', name: 'Smart Box 03', place: 'Hostel B lobby' },
  { id: 'B04', no: '04', name: 'Smart Box 04', place: 'Admin block' },
  { id: 'B05', no: '05', name: 'Smart Box 05', place: 'Food court' },
  { id: 'B06', no: '06', name: 'Smart Box 06', place: 'Sports complex', offline: true },
];

export const STUDENTS = [
  { id: '22BCE1043', name: 'Aarav Reddy', phone: '+91 98480 14310', hostel: 'Hostel A, room 214', color: '#7B61FF' },
  { id: '22BEC0871', name: 'Diya Sharma', phone: '+91 90002 55871', hostel: 'Hostel C, room 108', color: '#E0875A' },
  { id: '23BME0412', name: 'Kiran Varma', phone: '+91 99665 20412', hostel: 'Hostel B, room 331', color: '#2FA58B' },
  { id: '21BIT0199', name: 'Sneha Iyer', phone: '+91 97011 60199', hostel: 'Hostel C, room 015', color: '#D05C8E' },
  { id: '23BCS0620', name: 'Rohan Das', phone: '+91 88850 70620', hostel: 'Hostel A, room 402', color: '#4A86E8' },
  { id: '22BDS0115', name: 'Ananya Patel', phone: '+91 98123 45678', hostel: 'Hostel B, room 105', color: '#F59E0B' },
];

export const COURIERS = ['Amazon', 'Flipkart', 'Delhivery', 'Blue Dart', 'Meesho', 'Other'];
export const SIZES = ['Small', 'Medium', 'Large'];

export const boxById = (id) => BOXES.find((b) => b.id === id);
export const studentById = (id) => STUDENTS.find((s) => s.id === id);
export const pinFor = (orderId) => String(orderId).slice(-4);
export const initials = (n) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

/** Live view of orders, Box 01 hardware state, connection status and server clock. */
export function useCampusDrop() {
  const [state, setState] = useState({ orders: [], boxLive: {}, connected: false, offset: 0, loaded: false });

  useEffect(() => {
    const patch = (p) => setState((s) => ({ ...s, ...p }));
    const unsubs = [
      onValue(ref(db, '.info/connected'), (s) => patch({ connected: !!s.val() })),
      onValue(ref(db, '.info/serverTimeOffset'), (s) => patch({ offset: s.val() || 0 })),
      onValue(ref(db, 'orders'), (s) => patch({ orders: Object.values(s.val() || {}), loaded: true })),
      ...BOXES.filter((b) => b.real).map((b) =>
        onValue(ref(db, `boxes/${b.id}`), (s) =>
          setState((st) => ({ ...st, boxLive: { ...st.boxLive, [b.id]: s.val() || {} } }))
        )
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const now = () => Date.now() + state.offset;
  const boxOnline = (b) => {
    if (!b.real) return !b.offline;
    const seen = state.boxLive[b.id]?.lastSeen;
    return !!seen && now() - seen < HEARTBEAT_STALE_MS;
  };

  return { ...state, now, boxOnline };
}

export async function addOrder(order) {
  const patch = { [`orders/${order.id}`]: order };
  if (boxById(order.boxId)?.real) patch[`boxes/${order.boxId}/currentOrder`] = order.id;
  await update(ref(db), patch);
}

export async function updateOrder(order, fields) {
  const up = {};
  Object.entries(fields).forEach(([k, v]) => (up[`orders/${order.id}/${k}`] = v));
  if (fields.status === 'collected' && boxById(order.boxId)?.real) up[`boxes/${order.boxId}/currentOrder`] = null;
  await update(ref(db), up);
}

export function logEvent(boxId, action, payload = {}, dir = 'out') {
  // Fire and forget: the device log is informational only.
  const key = Math.random().toString(36).slice(2, 12);
  set(ref(db, `events/${key}`), { t: Date.now(), dir, boxId, action, payload, src: 'mobile' }).catch(() => {});
}

/** Sends lock/unlock to Box 01 and waits (up to 10 s) for the ESP8266 to acknowledge it. */
export async function sendCommand(boxId, action, reason = '') {
  logEvent(boxId, action === 'unlock' ? 'servo.unlock' : 'servo.lock', { reason });
  if (!boxById(boxId)?.real) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true, simulated: true };
  }
  const id = Math.random().toString(36).slice(2, 10);
  await set(ref(db, `boxes/${boxId}/command`), { action, id, t: serverTimestamp(), reason });
  return new Promise((resolve) => {
    let off = () => {};
    const timer = setTimeout(() => {
      off();
      resolve({ ok: false, error: 'Box did not respond in 10 s' });
    }, 10000);
    off = onValue(ref(db, `boxes/${boxId}/commandAck`), (s) => {
      if (s.val() === id) {
        clearTimeout(timer);
        off();
        resolve({ ok: true });
      }
    });
  });
}
