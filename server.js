const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'store.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Ensure data folder exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Default In-Memory Store
let store = {
  boxes: [
    { id: 'B01', no: '01', name: 'Smart Box 01', place: 'Hostel A, main gate', online: true, servoAngle: 0, locked: true, parcelPresent: false, ip: '192.168.1.101' },
    { id: 'B02', no: '02', name: 'Smart Box 02', place: 'Central library entrance', online: true, servoAngle: 0, locked: true, parcelPresent: false, ip: '192.168.1.102' },
    { id: 'B03', no: '03', name: 'Smart Box 03', place: 'Hostel B lobby', online: true, servoAngle: 0, locked: true, parcelPresent: false, ip: '192.168.1.103' },
    { id: 'B04', no: '04', name: 'Smart Box 04', place: 'Admin block', online: true, servoAngle: 0, locked: true, parcelPresent: false, ip: '192.168.1.104' },
    { id: 'B05', no: '05', name: 'Smart Box 05', place: 'Food court', online: true, servoAngle: 0, locked: true, parcelPresent: false, ip: '192.168.1.105' },
    { id: 'B06', no: '06', name: 'Smart Box 06', place: 'Sports complex', online: false, servoAngle: 0, locked: true, parcelPresent: false, ip: '192.168.1.106' }
  ],
  students: [
    { id: '22BCE1043', name: 'Aarav Reddy', phone: '+91 98480 14310', hostel: 'Hostel A, room 214', color: '#7B61FF' },
    { id: '22BEC0871', name: 'Diya Sharma', phone: '+91 90002 55871', hostel: 'Hostel C, room 108', color: '#E0875A' },
    { id: '23BME0412', name: 'Kiran Varma', phone: '+91 99665 20412', hostel: 'Hostel B, room 331', color: '#2FA58B' },
    { id: '21BIT0199', name: 'Sneha Iyer', phone: '+91 97011 60199', hostel: 'Hostel C, room 015', color: '#D05C8E' },
    { id: '23BCS0620', name: 'Rohan Das', phone: '+91 88850 70620', hostel: 'Hostel A, room 402', color: '#4A86E8' },
    { id: '22BDS0115', name: 'Ananya Patel', phone: '+91 98123 45678', hostel: 'Hostel B, room 105', color: '#F59E0B' }
  ],
  orders: [],
  events: []
};

// Load persistent data
function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      store = { ...store, ...data };
    }
  } catch (err) {
    console.warn('[Storage] Could not load data file, using defaults:', err.message);
  }
}
loadStore();

// Debounced save
let saveTimer = null;
function persistStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Error saving store:', err.message);
    }
  }, 300);
}

// Telemetry & Event logging
function logEvent(dir, boxId, action, payload = {}) {
  const ev = {
    id: 'EV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    t: Date.now(),
    dir, // 'in' or 'out'
    boxId,
    action,
    payload
  };
  store.events.unshift(ev);
  if (store.events.length > 80) store.events.pop();
  persistStore();
  broadcast('EVENT_LOGGED', ev);
  return ev;
}

// WebSocket broadcast
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIp}`);

  // Send initial snapshot
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    payload: {
      boxes: store.boxes,
      orders: store.orders,
      students: store.students,
      events: store.events.slice(0, 30)
    }
  }));

  ws.on('message', (msgStr) => {
    try {
      const data = JSON.parse(msgStr);
      console.log(`[WS] Received:`, data);

      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      } else if (data.type === 'ESP32_SENSOR') {
        // Hardware sensor pulse
        const { boxId, parcelPresent, distanceCm } = data.payload || {};
        const box = store.boxes.find(b => b.id === boxId);
        if (box) {
          box.parcelPresent = !!parcelPresent;
          logEvent('in', boxId, 'sensor.reading', { parcelPresent, distanceCm });
          broadcast('BOX_UPDATED', box);
        }
      } else if (data.type === 'ESP32_KEYPAD') {
        // Hardware keypad input stream
        const { boxId, key } = data.payload || {};
        logEvent('in', boxId, 'keypad.press', { key });
        broadcast('KEYPAD_EVENT', { boxId, key });
      }
    } catch (e) {
      console.error('[WS] Parse error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected`);
  });
});

/* ==========================================================================
   REST API Endpoints
   ========================================================================== */

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    wsClients: wss.clients.size,
    boxesCount: store.boxes.length,
    activeOrders: store.orders.filter(o => o.status === 'awaiting').length
  });
});

// Boxes
app.get('/api/boxes', (req, res) => {
  // Attach current active order if any
  const boxesWithOrders = store.boxes.map(b => {
    const activeOrder = store.orders.find(o => o.boxId === b.id && o.status === 'awaiting');
    return {
      ...b,
      activeOrder: activeOrder || null,
      state: !b.online ? 'offline' : (!b.locked ? 'open' : (activeOrder ? 'occupied' : 'free'))
    };
  });
  res.json(boxesWithOrders);
});

app.get('/api/boxes/:id', (req, res) => {
  const box = store.boxes.find(b => b.id === req.params.id);
  if (!box) return res.status(404).json({ error: 'Box not found' });
  const activeOrder = store.orders.find(o => o.boxId === box.id && o.status === 'awaiting');
  res.json({ ...box, activeOrder });
});

// Command: Unlock Box Servo
app.post('/api/boxes/:id/unlock', (req, res) => {
  const box = store.boxes.find(b => b.id === req.params.id);
  if (!box) return res.status(404).json({ error: 'Box not found' });

  const { reason = 'app_command', orderId = null, by = 'system' } = req.body || {};
  box.locked = false;
  box.servoAngle = 90; // 90 degrees = unlocked

  const ev = logEvent('out', box.id, 'servo.unlock', { reason, orderId, by });
  persistStore();
  broadcast('BOX_UPDATED', box);
  broadcast('HARDWARE_COMMAND', { boxId: box.id, action: 'SERVO_UNLOCK', angle: 90 });

  res.json({ success: true, box, event: ev });
});

// Command: Lock Box Servo
app.post('/api/boxes/:id/lock', (req, res) => {
  const box = store.boxes.find(b => b.id === req.params.id);
  if (!box) return res.status(404).json({ error: 'Box not found' });

  const { reason = 'app_command' } = req.body || {};
  box.locked = true;
  box.servoAngle = 0; // 0 degrees = locked

  const ev = logEvent('out', box.id, 'servo.lock', { reason });
  persistStore();
  broadcast('BOX_UPDATED', box);
  broadcast('HARDWARE_COMMAND', { boxId: box.id, action: 'SERVO_LOCK', angle: 0 });

  res.json({ success: true, box, event: ev });
});

// IoT Hardware Endpoint: Sensor report (IR / Ultrasonic)
app.post('/api/boxes/:id/sensor', (req, res) => {
  const box = store.boxes.find(b => b.id === req.params.id);
  if (!box) return res.status(404).json({ error: 'Box not found' });

  const { parcelPresent, distanceCm } = req.body;
  box.parcelPresent = !!parcelPresent;

  const ev = logEvent('in', box.id, 'sensor.trigger', { parcelPresent, distanceCm });
  persistStore();
  broadcast('BOX_UPDATED', box);

  res.json({ success: true, box, event: ev });
});

// Students
app.get('/api/students', (req, res) => {
  res.json(store.students);
});

// Orders
app.get('/api/orders', (req, res) => {
  let list = [...store.orders];
  if (req.query.status) list = list.filter(o => o.status === req.query.status);
  if (req.query.studentId) list = list.filter(o => o.studentId === req.query.studentId);
  if (req.query.boxId) list = list.filter(o => o.boxId === req.query.boxId);
  list.sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

// Register new parcel drop (Delivery Boy step)
app.post('/api/orders', (req, res) => {
  const { orderId, boxId, studentId, courier = 'Amazon', size = 'Medium' } = req.body;

  if (!orderId || !/^\d{4,}$/.test(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID. Must contain at least 4 digits.' });
  }

  // Check if box already has waiting parcel
  const existingInBox = store.orders.find(o => o.boxId === boxId && o.status === 'awaiting');
  if (existingInBox) {
    return res.status(409).json({ error: `Box ${boxId} already holds an uncollected parcel.` });
  }

  const student = store.students.find(s => s.id === studentId);
  const box = store.boxes.find(b => b.id === boxId);
  if (!box) return res.status(400).json({ error: 'Invalid box specified.' });

  const pin = String(orderId).slice(-4);
  const newOrder = {
    id: String(orderId),
    boxId,
    studentId: student ? student.id : studentId,
    studentName: student ? student.name : 'Student',
    phone: student ? student.phone : '',
    hostel: student ? student.hostel : '',
    courier,
    size,
    pin, // PIN is the last 4 digits of Order ID
    status: 'awaiting',
    attempts: 0,
    createdAt: Date.now()
  };

  store.orders.unshift(newOrder);
  box.parcelPresent = true;
  box.locked = true;
  box.servoAngle = 0;

  // Log events
  logEvent('in', boxId, 'order.registered', { orderId: newOrder.id, student: newOrder.studentName });
  logEvent('out', boxId, 'notify.student', { studentId: newOrder.studentId, pin, phone: newOrder.phone });

  persistStore();

  // Broadcast to all clients (including Student phone app simulator)
  broadcast('NEW_ORDER', newOrder);
  broadcast('NOTIFICATION', {
    title: 'Parcel Arrived! 📦',
    body: `Your ${courier} order #${orderId} is in ${box.name}. PIN: ${pin}`,
    order: newOrder
  });
  broadcast('BOX_UPDATED', box);

  res.status(201).json({ success: true, order: newOrder });
});

// Verify PIN (Student Pickup step)
app.post('/api/orders/verify-pin', (req, res) => {
  const { orderId, pin } = req.body;

  const order = store.orders.find(o => o.id === String(orderId) && o.status === 'awaiting');
  if (!order) {
    return res.status(404).json({ success: false, error: 'Active order not found.' });
  }

  // Check lockout
  if (order.lockedUntil && order.lockedUntil > Date.now()) {
    const waitSec = Math.ceil((order.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      locked: true,
      error: `Too many wrong PIN attempts. Box locked for ${waitSec}s.`,
      waitSec
    });
  }

  const box = store.boxes.find(b => b.id === order.boxId);

  if (String(pin) === String(order.pin)) {
    // PIN correct! Unlock box servo
    order.attempts = 0;
    if (box) {
      box.locked = false;
      box.servoAngle = 90;
    }

    logEvent('in', order.boxId, 'pin.verified', { orderId: order.id });
    logEvent('out', order.boxId, 'servo.unlock', { reason: 'pin_verified', orderId: order.id });

    persistStore();
    broadcast('PIN_VERIFIED', { orderId: order.id, boxId: order.boxId });
    if (box) broadcast('BOX_UPDATED', box);

    return res.json({
      success: true,
      message: 'PIN verified successfully. Door unlocked!',
      order,
      box
    });
  } else {
    // Wrong PIN
    order.attempts = (order.attempts || 0) + 1;
    let locked = false;
    let waitSec = 0;

    if (order.attempts % 5 === 0) {
      order.lockedUntil = Date.now() + 30000; // 30 sec lockout
      locked = true;
      waitSec = 30;
    }

    logEvent('in', order.boxId, 'pin.rejected', { orderId: order.id, attempts: order.attempts });
    persistStore();

    return res.status(401).json({
      success: false,
      message: 'Incorrect PIN. Please try again.',
      attempts: order.attempts,
      locked,
      waitSec
    });
  }
});

// Mark parcel collected
app.post('/api/orders/:id/collect', (req, res) => {
  const order = store.orders.find(o => o.id === String(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = 'collected';
  order.collectedAt = Date.now();

  const box = store.boxes.find(b => b.id === order.boxId);
  if (box) {
    box.parcelPresent = false;
    box.locked = true;
    box.servoAngle = 0;
  }

  logEvent('in', order.boxId, 'parcel.collected', { orderId: order.id });
  logEvent('out', order.boxId, 'servo.lock', { reason: 'collection_complete' });

  persistStore();
  broadcast('ORDER_COLLECTED', order);
  if (box) broadcast('BOX_UPDATED', box);

  res.json({ success: true, order, box });
});

// Telemetry events
app.get('/api/events', (req, res) => {
  res.json(store.events);
});

// Seed demo parcels
app.post('/api/seed-demo', (req, res) => {
  const freeBoxes = store.boxes.filter(b => b.online && !store.orders.some(o => o.boxId === b.id && o.status === 'awaiting'));
  if (!freeBoxes.length) {
    return res.status(400).json({ error: 'No free online boxes available to seed.' });
  }

  const demoItems = [
    { student: store.students[0], courier: 'Amazon', size: 'Medium' },
    { student: store.students[1], courier: 'Flipkart', size: 'Small' }
  ];

  const created = [];
  for (let i = 0; i < demoItems.length && i < freeBoxes.length; i++) {
    const { student, courier, size } = demoItems[i];
    const box = freeBoxes[i];
    const id = String(402900000000 + Math.floor(Math.random() * 9999999) * 10 + 12);
    const pin = id.slice(-4);
    const order = {
      id,
      boxId: box.id,
      studentId: student.id,
      studentName: student.name,
      phone: student.phone,
      hostel: student.hostel,
      courier,
      size,
      pin,
      status: 'awaiting',
      attempts: 0,
      createdAt: Date.now() - (i + 1) * 12 * 60000
    };
    store.orders.unshift(order);
    box.parcelPresent = true;
    created.push(order);
  }

  persistStore();
  broadcast('STATE_REFRESH', { boxes: store.boxes, orders: store.orders });
  res.json({ success: true, created });
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  CampusDrop Server running on http://localhost:${PORT}`);
  console.log(`  WebSocket live on ws://localhost:${PORT}/ws`);
  console.log(`  Serving Web App & Hardware API Gateway`);
  console.log(`====================================================`);
});
