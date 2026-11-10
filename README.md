# CampusDrop — Smart Campus Delivery Box System

An IoT-powered smart locker parcel delivery and pickup platform designed for university campuses and colleges. Built to streamline parcel logistics:

![CampusDrop System Flowchart](image.png)


## 🚀 Key Features

- **Separate Role Portals**:
  1. 🚚 **Delivery Boy Portal** (`#/deliver`): QR scan of the box, numeric Order ID input, automatic pickup PIN generation, student lookup, parcel size selection, and a guided 4-step drop flow that unlocks and locks the real box.
  2. 🎓 **Student Pickup Portal** (`#/collect`): Pending parcels, at-box QR check, then the PIN is typed on the **box's physical keypad** and mirrored live on the page. The servo unlocks automatically when the PIN is right.
  3. 🖥️ **Admin / Campus Overview Dashboard** (`#/dashboard`): Interactive Three.js 3D locker wall, live device event log, remote unlock, weekly volume chart, and searchable order records.
- **PIN Rule**:
  - The Pickup PIN is strictly the **last 4 digits of the Order ID** (e.g. Order `123456789012` &rarr; PIN `9012`).
- **Logins and roles** (Firebase mode): email/password accounts with **student**, **courier** and **admin** roles, enforced by the database rules. See *Accounts and roles* below.
- **Real-Time Notifications**:
  - When a parcel is registered, the student it belongs to gets a phone-style notification banner with a chime on every device they're signed in on. SMS will be added later.
- **One real box, five simulated**:
  - **Box 01** is the physical box (ESP8266 + Arduino UNO). **Boxes 02–06** are simulated in the browser.
- **Two modes**:
  - **Firebase mode**: when `firebase-config.js` is filled in, orders, box state and device events sync live through **Firebase Realtime Database** across all devices and the real box.
  - **This device only**: with no Firebase config, everything runs in the browser (`localStorage`) and all six boxes are simulated.
## 📁 Project Structure
campus drop/
├── index.html                       # Web app (all portals & 3D visualizer)
├── firebase-config.js               # Your Firebase web config (fill this in)
├── database.rules.json              # Realtime Database rules
├── firebase.json                    # Firebase Hosting + database config
├── server.js                        # Small local web server (npm start)
├── image.png                        # System flowchart
└── firmware/
    ├── esp8266_campusdrop/          # ESP8266: WiFi, Firebase, keypad
    ├── uno_campusdrop/              # Arduino UNO: servo, HC-SR04, 16x2 I2C LCD
    └── HARDWARE_GUIDE.md            # Wiring, flashing, calibration, troubleshooting
```

---

## 🔥 Firebase Setup (one time)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. **Build → Realtime Database → Create database** (pick the location closest to you, e.g. Singapore).
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
4. **Project settings → General → Your apps → Add app → Web**. Copy the `firebaseConfig` values into `firebase-config.js`.
5. Open the website, **Create account** for yourself, then make yourself the first admin: in **Realtime Database → Data**, open `users/<your uid>` and change `role` from `student` to `admin`. From then on, change roles from the **People** table on the Dashboard.
6. In the database's **Rules** tab, paste the contents of `database.rules.json` and publish (or `npx firebase-tools deploy --only database`).
7. Firmware: put the database host (without `https://`) into `FIREBASE_HOST`, and a database secret into `FIREBASE_AUTH`, in `firmware/esp8266_campusdrop/esp8266_campusdrop.ino`. Get the secret from **Project settings → Service accounts → Database secrets → Show**. Without it the box is refused by the rules.

### Accounts and roles

| Role | Pages | Can |
|---|---|---|
| **student** (every new sign-up) | Collect | See only their own parcels and PINs, collect them |
| **courier** | Dashboard, Deliver | Register parcels for registered students, unlock an *empty* box to drop a parcel |
| **admin** | Dashboard, Deliver | Everything a courier can, plus remote unlock of any box, demo parcels, and changing roles |

The rules in `database.rules.json` enforce this on Firebase's side, not just in the page. Sign-ups with nobody's role changed only ever see their own (empty) parcel list.

> ⚠️ The database secret gives the box full access. Keep it out of any public repository, and treat the sketch file like a password.

---

## 🏃 Quick Start

```bash
npm install
npm start
```

Open 👉 **`http://localhost:3000`**. The top of the page shows **Live sync via Firebase** when Firebase is connected, or **This device only** when it isn't.

To put it online, install the Firebase CLI and deploy with Hosting:
```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting,database
```

---

## 🔌 Hardware (Box 01)

See [`firmware/HARDWARE_GUIDE.md`](firmware/HARDWARE_GUIDE.md) for full wiring, flashing, and calibration.

| Part | Board | Pins |
|---|---|---|
| 4×4 keypad | ESP8266 | Rows D1, D3, D4, D5 · Cols D6, D7, D8, D0 |
| SG90 servo | UNO | D9 (0° locked, 90° unlocked) |
| HC-SR04 ultrasonic | UNO | TRIG D7, ECHO D6 |
| 16×2 I2C LCD | UNO | SDA A4, SCL A5 |
| UNO ↔ ESP8266 serial | both | UNO TX → 1k/2k divider → ESP RX, ESP TX → UNO RX, common GND |
----
## 🗄️ Firebase Data

| Path | Written by | Contents |
|---|---|---|
| `orders/{orderId}` | website, ESP8266 | student, box, courier, size, `pin`, `status` (`awaiting` / `collected`), `attempts`, timestamps |
| `boxes/B01` | ESP8266, website | `lastSeen` heartbeat, `locked`, `servoAngle`, `parcelPresent`, `distanceCm`, `keypad` (digits typed so far), `currentOrder` |
| `boxes/B01/command` | website | `{ action: "unlock" \| "lock", id }`. The ESP8266 runs it and writes `commandAck = id` |
| `events/{id}` | website, ESP8266 | device log shown on the dashboard |
Live Webapp:- https://campus-drop-zeta.vercel.app/ 
(The website is subject to be changed as per the time changes)