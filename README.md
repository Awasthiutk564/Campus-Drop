# CampusDrop — Smart Campus Delivery Box System

An IoT-powered smart locker parcel delivery and pickup platform designed for university campuses and colleges. Built to streamline parcel logistics: **Drop &rarr; Notify &rarr; Verify &rarr; Collect**.

![CampusDrop System Flowchart](flowchart.png)

---

## 🚀 Key Features

- **Separate Role Portals**:
  1. 🚚 **Delivery Boy Portal** (`#/deliver`): QR scanner, numeric Order ID input, automatic pickup PIN generation, student lookup, parcel size selection, and guided 4-step hardware drop flow.
  2. 🎓 **Student Pickup Portal** (`#/collect`): Active parcel shelf, at-box QR presence verification, interactive 4-digit PIN keypad, automatic servo door unlocking, and pickup confirmation ("Thank You! Have a Nice Day").
  3. 🖥️ **Admin / Campus Overview Dashboard** (`#/dashboard`): Interactive Three.js 3D locker wall, live telemetry console, emergency remote servo overrides, weekly volume analytics, and searchable order records with CSV export.
  4. 🛠️ **ESP32 IoT Hardware Bench** (`#/hardware`): Real-time hardware simulator with virtual 16x2 OLED screen, servo angle dial (0° Locked &rarr; 90° Unlocked), IR / Ultrasonic distance sensor simulator, and physical 4x4 matrix keypad.
- **PIN Rule**:
  - The Pickup PIN is strictly the **last 4 digits of the Order ID** (e.g. Order `123456789012` &rarr; PIN `9012`).
- **Real-Time Notification Simulator**:
  - Floating mock mobile lockscreen push notification banner with audio chime when parcels arrive.
- **Dual-Mode Operation**:
  - **Live Server Mode**: Connects to the local Node.js Express + WebSocket server (`http://localhost:3000`) for live multi-device syncing and real ESP32 WiFi connectivity.
  - **Standalone Browser Mode**: Automatically falls back to client-side `localStorage` and simulated hardware if opened directly as a file.

---

## 📁 Project Structure

```
campus drop/
├── index.html                  # Full-featured Web Application (All Portals & 3D Visualizer)
├── server.js                   # Node.js Express & WebSocket Backend API Gateway
├── package.json                # Dependencies (express, ws, cors)
├── data/
│   └── store.json              # Persistent database for boxes, students, orders, telemetry
├── firmware/
│   ├── esp32_campusdrop.ino    # Ready-to-flash Arduino C++ sketch for ESP32
│   └── HARDWARE_GUIDE.md       # Full circuit schematic, wiring diagrams, and pinout table
└── test/
    └── api_test.js             # Automated API test suite
```

---
Local host server might vary according to the network and device specifically

## 🏃 Quick Start

### 1. Run the Backend Server
```bash
# Install dependencies
npm install

# Start the server on port 3000
npm start
```

Open your browser at:
👉 **`http://localhost:3000`**

### 2. Run API Tests
```bash
npm test
```

---

## 🔌 Hardware Integration (ESP32)

See [`firmware/HARDWARE_GUIDE.md`](firmware/HARDWARE_GUIDE.md) for complete circuit wiring.

- **Actuator**: TowerPro SG90 / MG996R Servo on **GPIO 13** (0° = Locked, 90° = Unlocked).
- **Sensor**: HC-SR04 Ultrasonic (Trig **GPIO 5**, Echo **GPIO 18**) or TCRT5000 IR on **GPIO 19**.
- **Display**: SSD1306 0.96" I2C OLED (SDA **GPIO 21**, SCL **GPIO 22**).
- **Keypad**: 4x4 Membrane Keypad on GPIOs 12, 14, 27, 26 (Rows) & 25, 33, 32, 23 (Cols).
- **RGB Status LED**: Red **GPIO 4**, Green **GPIO 16**, Blue **GPIO 17**.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server uptime & status |
| `GET` | `/api/boxes` | All smart boxes & servo/sensor states |
| `POST` | `/api/boxes/:id/unlock` | Command servo to 90° (Unlocked) |
| `POST` | `/api/boxes/:id/lock` | Command servo to 0° (Locked) |
| `POST` | `/api/boxes/:id/sensor` | IoT endpoint for IR/ultrasonic sensor |
| `GET` | `/api/orders` | List registered orders |
| `POST` | `/api/orders` | Register parcel drop (generates PIN) |
| `POST` | `/api/orders/verify-pin` | Verify 4-digit PIN & trigger unlock |
| `POST` | `/api/orders/:id/collect` | Mark order collected & re-lock |
| `GET` | `/api/events` | Real-time hardware telemetry logs |
| `POST` | `/api/seed-demo` | Add sample test parcels |
Server, Models, and Web Apps(DOM) has been tested and verified by the Agents.