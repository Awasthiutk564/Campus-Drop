# CampusDrop Report — Content Draft

> **How to use this file:** copy each section into your Word/PDF template in the same order as the reference report.
> Every `📷 [INSERT …]` line marks where a picture goes. Items in `‹angle brackets›` are details only you know (names, course, results) — fill them in.

---

## COVER PAGE

SRM University, Andhra Pradesh
Department of Electronics and Communication Engineering

**PROJECT REPORT ON**
**CampusDrop — IoT-Based Smart Campus Delivery Box System**
*(ESP8266 + Arduino UNO + Firebase Realtime Database)*

Submitted by: ‹Shubham R. Mete, Utkarsh Awasthi, Aniket Kumar — edit as needed›
Subject: ‹course name and code›
Department: Electronics and Communication Engineering
College: SRM University, Andhra Pradesh
Faculty Guide: ‹name›

Signature of Course Instructor

> 📷 **[INSERT HARDWARE PHOTO – optional]:** a clean photo of the finished Box 01 can go on the cover under the title.

---

## ACKNOWLEDGEMENT

We sincerely thank our Faculty Guide, ‹name›, for their invaluable guidance and constant support throughout this project. We are grateful to the Head of the Department of ECE and the management of SRM University Andhra Pradesh for providing the laboratory facilities and an environment that promotes practical learning. We also thank our team members for their dedication, and the open-source communities behind the Arduino and ESP8266 cores, the Keypad, ArduinoJson and LiquidCrystal I2C libraries, Three.js, and Google Firebase, whose tools and documentation were essential to the success of this project.

---

## ABSTRACT

Parcel delivery on university campuses is often unorganised: parcels are left at hostel gates or security desks, students must be present to receive them, and items are misplaced or collected by the wrong person. This project, **CampusDrop**, is a prototype of a smart locker-style delivery box that follows a four-step flow: **Drop → Notify → Verify → Collect**.

The system has two parts. The **hardware** (Box 01) combines an ESP8266 NodeMCU, which handles Wi-Fi, the cloud connection and a 4×4 keypad, with an Arduino UNO, which drives an SG90 servo lock, an HC-SR04 ultrasonic parcel sensor and a 16×2 I2C LCD. The two boards communicate over a 9600-baud serial link using a simple text protocol. The **software** is a single-page web application with three role-based portals — Delivery, Student Pickup and Admin Dashboard — that shares data with the box in real time through the Firebase Realtime Database.

A delivery person scans the box, enters the order ID and the student, and the website unlocks the door remotely. After the parcel is placed, the ultrasonic sensor confirms its presence, the door locks, and the student is notified. The student then types a 4-digit PIN (the last four digits of the Order ID) on the box's physical keypad; if it is correct, the servo unlocks and the box re-locks automatically. The admin dashboard shows a live 3D locker wall, a device event log, weekly statistics and remote unlock. The prototype demonstrates that low-cost microcontrollers and a cloud database can form a secure, contact-free and trackable campus delivery solution.

**Keywords:** IoT, smart locker, ESP8266, Arduino UNO, Firebase, servo lock, keypad PIN, ultrasonic sensor.

---

## TABLE OF CONTENTS

1. Introduction
2. Literature Review
3. Theory
4. Methodology
5. Implementation
6. Results and Discussion
7. Advantages & Limitations
8. Applications & Future Scope
9. Conclusion
10. Individual Contribution
11. References

---

## 1. INTRODUCTION

The Internet of Things (IoT) connects physical devices — sensors, actuators and microcontrollers — to the internet so that they can be monitored and controlled remotely. Together with the growth of online shopping, IoT has made automated parcel lockers common in cities. University campuses have the same problem at a smaller scale: hundreds of students order parcels every day, but delivery staff often cannot enter hostels, students are in class when the courier arrives, and parcels pile up at security desks with no record of who collected what.

**CampusDrop** addresses this with a smart delivery box. The courier drops the parcel into a lockable box at any time; the student is notified instantly; and the box opens only when the student enters the correct PIN on its keypad. Every action is logged in the cloud and visible to the campus admin.

**Objectives**
1. Design a working smart box that locks and unlocks automatically using a servo.
2. Detect whether a parcel is physically inside the box using an ultrasonic sensor.
3. Verify the student with a 4-digit PIN entered on a physical keypad.
4. Synchronise the box with a web application in real time through Firebase.
5. Provide separate portals for delivery staff, students and administrators.

This project applies embedded-systems concepts (GPIO, PWM servo control, serial communication, sensor interfacing) together with cloud-based web development.

---

## 2. LITERATURE REVIEW

Parcel delivery has moved from manual hand-over, to staffed collection desks, to automated self-service lockers. Commercial smart lockers (for example those used by large e-commerce companies and postal services) use touch screens, barcodes and one-time passwords, and are typically connected to a central server. Academic work on IoT-based lockers and smart door locks commonly uses microcontrollers such as Arduino, ESP8266 or ESP32, keypad or RFID authentication, and a cloud service for notifications.

The ESP8266 became popular because it integrates Wi-Fi in a low-cost board that is programmable from the Arduino IDE. Cloud back-ends such as Firebase Realtime Database provide real-time synchronisation across devices without the need to run a custom server, which makes them well suited to student prototypes. Ultrasonic distance sensors such as the HC-SR04 are widely used for presence and level detection, and hobby servos such as the SG90 are a simple way to build a latch mechanism.

This project combines these well-known techniques into a single, low-cost, end-to-end prototype: a physical box, a cloud database and a role-based web application tailored for campus use. *(Add one or two papers you read, if your course requires citations — see References.)*

---

## 3. THEORY

### 3.1 Internet of Things architecture
The system follows a three-layer IoT architecture: a **perception layer** (keypad, ultrasonic sensor, servo, LCD), a **network layer** (ESP8266 Wi-Fi, HTTPS, Firebase) and an **application layer** (the web portals).

> 📷 **[INSERT FIGURE – System flowchart]:** use the existing `image.png` from the project folder (the CampusDrop workflow image from the README). Caption: *Fig. 3.1 – CampusDrop system flowchart.*

### 3.2 ESP8266 NodeMCU
A 32-bit microcontroller with built-in 2.4 GHz Wi-Fi, running at 3.3 V logic. In this project it connects to Wi-Fi, talks to Firebase through its HTTPS REST API, scans the keypad and sends commands to the UNO. Its boot-strap pins (D3, D4, D8) and the lack of an internal pull-up on D0 (GPIO16) influenced the keypad wiring.

### 3.3 Arduino UNO
An ATmega328P board running at 5 V logic. It acts as the *I/O board* of the box: it drives the servo, reads the ultrasonic sensor and writes to the LCD, so that time-critical hardware work is separated from networking.

### 3.4 SG90 servo lock
A micro servo controlled by a PWM signal. The shaft is set to **0° for locked** and **90° for unlocked**; the arm blocks or frees the door latch.

### 3.5 HC-SR04 ultrasonic sensor
The sensor sends a 10 µs trigger pulse, emits an ultrasonic burst and measures the echo time. The distance is

> **Distance (cm) = (echo time in µs × 0.0343) / 2**

If the measured distance falls below a calibrated threshold (12 cm in our build), a parcel is considered present. A reading must be stable for four consecutive samples (250 ms apart) before the state changes, which filters out noise.

### 3.6 4×4 matrix keypad
Sixteen keys are arranged in 4 rows and 4 columns, so only 8 GPIO pins are needed. The library scans rows and columns to find the pressed key. In our design `*` clears the entry and `#` deletes the last digit.

### 3.7 I2C 16×2 LCD
Uses the I2C protocol (SDA on A4, SCL on A5), which needs only two data lines. It shows the box status and masked PIN entry (`*`) to the user.

### 3.8 Serial communication and level shifting
The two boards exchange newline-terminated text commands at 9600 baud. The UNO's 5 V TX is reduced to about 3.3 V for the ESP8266 using a 1 kΩ / 2 kΩ voltage divider:

> **V_out = 5 V × 2k / (1k + 2k) ≈ 3.3 V**

The ESP8266's 3.3 V TX is read correctly by the UNO without a divider.

### 3.9 Firebase Realtime Database
A cloud NoSQL database that stores data as a JSON tree and pushes changes to all connected clients. The website listens to it live, and the ESP8266 reads and writes it over HTTPS.

### 3.10 PIN rule
The pickup PIN is the **last 4 digits of the Order ID** (e.g., Order `123456789012` → PIN `9012`), so no separate PIN needs to be stored or sent.

---

## 4. METHODOLOGY

### 4.1 Overall workflow

```
Website (phone/laptop) ⇄ Firebase Realtime DB ⇄ ESP8266 ⇄ serial ⇄ Arduino UNO → servo / LCD
                                                   ↑                      ↑
                                                keypad                ultrasonic
```

### 4.2 Drop-off (delivery person)
1. The courier opens the **Delivery portal** (`#/deliver`), scans the box QR code and enters the numeric Order ID.
2. The website generates the PIN, looks up the student and the user picks the parcel size.
3. On **Unlock door**, the website writes `boxes/B01/command = unlock`. The ESP8266 checks this every second, tells the UNO `UNLOCK`, the servo turns to 90°, and the ESP8266 writes `commandAck`.
4. The courier places the parcel; the ultrasonic sensor detects it and the ESP8266 sets `parcelPresent = true`.
5. On **Close door and register**, the servo returns to 0°, the order is saved with status `awaiting`, and `currentOrder` is set.
6. Every open copy of the website shows a phone-style notification banner with a chime to the student.

### 4.3 Pickup (student)
1. The student opens the **Pickup portal** (`#/collect`), sees pending parcels and confirms they are at the box.
2. The PIN is typed on the **physical keypad**. Each digit appears as `*` on the LCD and as a dot on the website in real time.
3. After the fourth digit, the ESP8266 reads `currentOrder` and compares the PIN with the last 4 digits of the order ID.
4. **Correct PIN:** the order is marked `collected`, the servo unlocks, the LCD shows "Take your parcel", and the box locks again after 15 s.
5. **Wrong PIN:** the attempt count is shown on the website; after 5 wrong attempts the keypad is blocked for 30 s.

### 4.4 Admin monitoring
The **Dashboard** (`#/dashboard`) shows a 3D locker wall, live event log, weekly delivered/collected chart, searchable orders and a remote unlock button.

### 4.5 Heartbeat and safety
The ESP8266 reports to Firebase every 10 s; if the website hears nothing for 30 s, Box 01 is shown as **Offline**. A safety auto-lock closes the door if the website never sends a `LOCK` command.

### 4.6 Firebase data model

| Path | Written by | Contents |
|---|---|---|
| `orders/{orderId}` | website, ESP8266 | student, box, courier, size, pin, status, attempts, timestamps |
| `boxes/B01` | ESP8266, website | lastSeen, locked, servoAngle, parcelPresent, distanceCm, keypad, currentOrder |
| `boxes/B01/command` | website | `{ action: unlock / lock, id }` |
| `events/{id}` | website, ESP8266 | device log shown on the dashboard |

### 4.7 Serial protocol between the boards

| From → To | Message | Meaning |
|---|---|---|
| ESP → UNO | `LOCK` / `UNLOCK` | Move the servo |
| ESP → UNO | `LCD:<line1>\|<line2>` | Show text |
| ESP → UNO | `STATUS` | Ask for current state |
| UNO → ESP | `ACK:LOCK` / `ACK:UNLOCK` | Servo moved |
| UNO → ESP | `PARCEL:<0/1>:<cm>` | Parcel appeared/disappeared |
| UNO → ESP | `STATE:<locked>:<parcel>:<cm>` | Reply to STATUS |
| UNO → ESP | `READY` | UNO has started |

---

## 5. IMPLEMENTATION

### 5.1 Hardware components

| Component | Connected to | Function |
|---|---|---|
| ESP8266 NodeMCU (ESP-12E) | Wi-Fi | Cloud communication, keypad, PIN verification |
| Arduino UNO | ESP8266 (serial) | Servo, sensor and LCD driver |
| 4×4 membrane keypad | ESP8266 | PIN entry |
| SG90 micro servo | UNO D9 | Door lock (0° / 90°) |
| HC-SR04 ultrasonic sensor | UNO D7 (TRIG), D6 (ECHO) | Parcel presence |
| 16×2 LCD with I2C | UNO A4 (SDA), A5 (SCL) | Status display |
| 1 kΩ + 2 kΩ resistors | UNO TX → ESP RX | 5 V → 3.3 V level divider |
| Box enclosure, jumper wires, power supply | — | Mechanical and power |

> 📷 **[INSERT HARDWARE PHOTO 1 – All components laid out]:** every part on a table, labelled. Caption: *Fig. 5.1 – Components used.*

### 5.2 Circuit connections

**Keypad → ESP8266:** R1→D1, R2→D3, R3→D4, R4→D5, C1→D6, C2→D7, C3→D8, C4→D0.
*(R1 and C4 were swapped from the first build because D0/GPIO16 has no internal pull-up and cannot be used as a keypad row.)*

**HC-SR04 → UNO:** VCC→5 V, GND→GND, TRIG→D7, ECHO→D6.
**LCD → UNO:** GND→GND, VCC→5 V, SDA→A4, SCL→A5.
**Servo → UNO:** Red→5 V, Brown/Black→GND, Orange/Yellow→D9.
**UNO ↔ ESP8266:** UNO TX → 1 kΩ → ESP RX (with 2 kΩ to GND), ESP TX → UNO RX, common GND.

> 📷 **[INSERT DIAGRAM / HARDWARE PHOTO 2 – Wiring]:** a circuit diagram (draw in Fritzing or by hand) **and/or** a top-down photo of the breadboard wiring. Caption: *Fig. 5.2 – Circuit connections of Box 01.*

> 📷 **[INSERT HARDWARE PHOTO 3 – Inside the box]:** servo with the latch arm, ultrasonic sensor facing into the box, boards mounted. Caption: *Fig. 5.3 – Internal arrangement.*

> 📷 **[INSERT HARDWARE PHOTO 4 – Outside / front of the box]:** keypad and LCD on the front panel. Caption: *Fig. 5.4 – Front panel of the smart box.*

### 5.3 Firmware

**Arduino UNO sketch (`uno_campusdrop.ino`)** — uses `Servo`, `Wire` and `LiquidCrystal_I2C`. It moves the servo on `LOCK`/`UNLOCK`, measures distance every 250 ms, flips the parcel state after 4 stable readings (threshold 12 cm), and replies with `ACK`, `PARCEL` and `STATE` messages.

**ESP8266 sketch (`esp8266_campusdrop.ino`)** — uses `ESP8266WiFi`, `ESP8266HTTPClient`, `ArduinoJson` and `Keypad`. It connects to Wi-Fi, polls `boxes/B01/command` every second, sends a heartbeat every 10 s, mirrors typed digits to Firebase (batched every 200 ms), verifies the PIN, enforces the attempt limit (5 tries → 30 s lockout), auto-locks 15 s after a PIN unlock and logs events.

Software tools: Arduino IDE; ESP8266 board package; libraries Keypad (Mark Stanley), ArduinoJson v7, LiquidCrystal I2C.

> 📷 **[OPTIONAL – SCREENSHOT]:** the Arduino IDE with each sketch open, or the Serial Monitor showing `STATE:` and `ACK:` lines. Caption: *Fig. 5.5 – Serial Monitor output.*

### 5.4 Calibration
With the box empty and closed, the empty-box distance is read from the Serial Monitor (`STATE:1:0:<cm>`), and `PARCEL_THRESHOLD_CM` is set a few cm below it. ‹Write your measured values, e.g. empty = ‹__› cm, threshold = 12 cm.›

### 5.5 Web application
A single-page application (`index.html`) with hash-based routing, written in HTML, CSS and JavaScript. The 3D locker wall uses **Three.js**, the weekly chart is drawn with SVG, and data sync uses the **Firebase Realtime Database** SDK. It supports two modes: *Firebase mode* (live sync across devices and the real box) and *This device only* (all boxes simulated in `localStorage`). Box 01 is the physical box; Boxes 02–06 are simulated. The app can be hosted using Firebase Hosting.

| Portal | Route | Main features |
|---|---|---|
| Delivery | `#/deliver` | QR scan of box, Order ID input, PIN generation, student lookup, size selection, 4-step drop flow |
| Student Pickup | `#/collect` | Pending parcels, at-box check, live PIN mirror |
| Admin Dashboard | `#/dashboard` | 3D locker wall, event log, remote unlock, weekly chart, order search |

---

## 6. RESULTS AND DISCUSSION

The prototype was tested end to end. Each stage below was checked and the behaviour observed. *(Replace the "Observed" lines with your actual test results.)*

### 6.1 Website — Admin Dashboard
The dashboard displayed the 3D locker wall with Box 01 live and Boxes 02–06 simulated, a device event log, statistics and the weekly delivered/collected chart.

> 📷 **[INSERT WEBSITE SCREENSHOT 1 – Dashboard]:** full dashboard showing the 3D locker wall, stats and chart. Caption: *Fig. 6.1 – Admin dashboard.*
> 📷 **[INSERT WEBSITE SCREENSHOT 2 – Order records / event log]:** the order table and device event log. Caption: *Fig. 6.2 – Orders and device events.*

### 6.2 Website — Delivery portal
The courier flow (QR scan → Order ID → student → size → unlock → close and register) completed successfully.

> 📷 **[INSERT WEBSITE SCREENSHOT 3 – Delivery portal]:** the Order ID entry / student lookup step. Caption: *Fig. 6.3 – Delivery portal.*
> 📷 **[INSERT WEBSITE SCREENSHOT 4 – Drop steps]:** the unlock-door and close-door steps. Caption: *Fig. 6.4 – Guided 4-step drop flow.*

### 6.3 Notification
After registration, a phone-style notification banner and chime appeared on all open pages.

> 📷 **[INSERT WEBSITE SCREENSHOT 5 – Notification banner]:** the banner on the student's page. Caption: *Fig. 6.5 – Parcel arrival notification.*

### 6.4 Student pickup and keypad
Digits typed on the physical keypad appeared as `*` on the LCD and as dots on the website live. A correct PIN unlocked the servo; wrong PINs raised the attempt counter, and five wrong tries blocked the keypad for 30 s.

> 📷 **[INSERT WEBSITE SCREENSHOT 6 – Pickup page]:** pending parcels and the live PIN dots. Caption: *Fig. 6.6 – Student pickup portal.*
> 📷 **[INSERT HARDWARE PHOTO 5 – Keypad + LCD in use]:** a hand typing the PIN, LCD showing `****`. Caption: *Fig. 6.7 – PIN entry on the box.*
> 📷 **[INSERT HARDWARE PHOTO 6 – Door unlocked]:** servo in the 90° position / door open. Caption: *Fig. 6.8 – Box unlocked after correct PIN.*
> 📷 **[INSERT HARDWARE PHOTO 7 – LCD messages]:** "Take your parcel" and a wrong-PIN message. Caption: *Fig. 6.9 – LCD status messages.*

### 6.5 Parcel detection
The ultrasonic sensor read ‹__› cm with the box empty and ‹__› cm with a parcel inside, so the 12 cm threshold separated the two states reliably.

> 📷 **[INSERT HARDWARE PHOTO 8 – Parcel inside the box]:** a parcel placed in front of the sensor. Caption: *Fig. 6.10 – Parcel detection.*

### 6.6 Hardware–cloud synchronisation
Commands from the website reached the box within about ‹__› s, and the box state (locked, parcel present, keypad digits) appeared on the website. When the ESP8266 was powered off, the website marked Box 01 as **Offline** after 30 s.

> 📷 **[INSERT SCREENSHOT – Firebase console]:** the Realtime Database tree showing `orders`, `boxes/B01`, `events`. Caption: *Fig. 6.11 – Firebase Realtime Database.*

### 6.7 Summary of test results

| Test | Expected | Observed |
|---|---|---|
| Remote unlock from website | Servo to 90° | ‹Pass/Fail› |
| Parcel detection | `parcelPresent = true` | ‹Pass/Fail› |
| Correct PIN | Servo unlocks, order = collected | ‹Pass/Fail› |
| Wrong PIN | Attempt counter increases | ‹Pass/Fail› |
| 5 wrong PINs | Keypad blocked for 30 s | ‹Pass/Fail› |
| Auto-lock after PIN unlock | Locks after 15 s | ‹Pass/Fail› |
| Offline detection | Offline after 30 s without heartbeat | ‹Pass/Fail› |
| Notification | Banner on all open pages | ‹Pass/Fail› |

---

## 7. ADVANTAGES & LIMITATIONS

**Advantages**
- **Contact-free and 24×7:** couriers drop parcels at any time and students collect at their convenience.
- **Secure verification:** the box opens only after the correct PIN is typed on the physical keypad.
- **Real-time visibility:** orders, box state and events are visible to the admin live.
- **Low cost:** built from inexpensive, widely available components.
- **No custom server:** Firebase provides hosting and real-time sync.
- **Modular design:** the networking board and I/O board are separate and easy to debug.
- **Scalable:** extra boxes can be added using the same data model.

**Limitations**
- **Only one physical box:** Boxes 02–06 are simulated in the browser.
- **Open database rules:** the demo rules allow anyone with the database URL to read and write; they must be locked down before real use.
- **Weak PIN:** the PIN is the last four digits of the Order ID, so it is guessable by someone who knows the order number.
- **No SMS/e-mail:** notifications are shown on the website only.
- **Basic parcel sensing:** an ultrasonic sensor detects presence only, not parcel identity or size.
- **Polling delay:** the ESP8266 checks for commands once per second, so there is up to ~1 s delay.
- **Needs 2.4 GHz Wi-Fi and power:** the box stops working during a Wi-Fi or power failure.
- **SG90 strength:** a micro servo is suitable for a prototype latch, not a high-security lock.

---

## 8. APPLICATIONS & FUTURE SCOPE

**Applications**
- University and school campuses (hostel and department parcel boxes).
- Apartment complexes and gated societies.
- Office buildings and co-working spaces.
- Library book return and pickup boxes.
- Pharmacy or food pickup points.

**Future Scope**
- Replace the demo database rules with Firebase Authentication and strict security rules.
- Generate random one-time PINs instead of deriving them from the Order ID.
- Add SMS / e-mail / push notifications.
- Add a camera or load cell for parcel verification and size detection.
- Replace the SG90 with a solenoid or electromagnetic lock for stronger security.
- Use ESP32 and Firebase streaming (instead of polling) for faster response.
- Build a multi-box locker wall with a central controller and RFID / QR / fingerprint access.
- Add a battery backup and solar power.
- Provide a mobile app and analytics for campus logistics.

---

## 9. CONCLUSION

CampusDrop successfully demonstrated an IoT-based smart delivery box that connects physical hardware to a cloud-synchronised web application. The ESP8266 and Arduino UNO combination reliably controlled the servo lock, read the ultrasonic parcel sensor, displayed status on the LCD and verified PINs from the keypad, while Firebase kept the box, the courier, the student and the admin in sync in real time. The prototype confirmed that a low-cost, modular design can solve a real campus logistics problem and provided hands-on experience in embedded programming, sensor interfacing, serial communication, cloud databases and web development. With improved security and scaling to multiple boxes, the project can be developed into a practical campus-wide parcel locker system.

---

## 10. INDIVIDUAL CONTRIBUTION

*(Edit to match who actually did what — the table below is a suggested split.)*

| Member | Contribution |
|---|---|
| ‹Member 1› | Hardware assembly, circuit wiring, Arduino UNO firmware (servo, ultrasonic sensor, LCD), calibration |
| ‹Member 2› | ESP8266 firmware (Wi-Fi, Firebase, keypad, PIN verification), UNO–ESP serial protocol |
| ‹Member 3› | Web application (Delivery, Pickup and Admin portals, 3D dashboard), Firebase setup, testing, report and documentation |

---

## 11. REFERENCES

1. Arduino. *Arduino Documentation.* https://docs.arduino.cc/
2. ESP8266 Community. *ESP8266 Arduino Core Documentation.* https://arduino-esp8266.readthedocs.io/
3. Espressif Systems. *ESP8266EX Datasheet.* https://www.espressif.com/
4. Google. *Firebase Realtime Database Documentation.* https://firebase.google.com/docs/database
5. Google. *Firebase Realtime Database REST API.* https://firebase.google.com/docs/reference/rest/database
6. Three.js. *Three.js Documentation.* https://threejs.org/docs/
7. Mark Stanley. *Keypad Library for Arduino.* https://github.com/Chris--A/Keypad
8. Benoit Blanchon. *ArduinoJson Documentation.* https://arduinojson.org/
9. Frank de Brabander. *LiquidCrystal_I2C Library.*
10. Arduino. *Servo Library Reference.* https://www.arduino.cc/reference/en/libraries/servo/
11. Cytron / Elec Freaks. *HC-SR04 Ultrasonic Sensor Datasheet.*
12. Monk, S. *Programming Arduino: Getting Started with Sketches.* McGraw-Hill.
13. Madakam, S., Ramaswamy, R., and Tripathi, S. "Internet of Things (IoT): A Literature Review," *Journal of Computer and Communications*, 2015.

---

# FIGURE CHECKLIST (delete before submitting)

## 📷 Hardware photos to take
| # | What to photograph | Goes in |
|---|---|---|
| H0 | Finished box, clean shot (optional) | Cover page |
| H1 | All components laid out and labelled | §5.1 |
| H2 | Wiring / breadboard top view (+ circuit diagram) | §5.2 |
| H3 | Inside of box: servo latch, ultrasonic sensor, boards | §5.2 |
| H4 | Front panel: keypad + LCD | §5.2 |
| H5 | Typing the PIN, LCD showing `****` | §6.4 |
| H6 | Door unlocked (servo at 90°) | §6.4 |
| H7 | LCD messages ("Take your parcel", wrong PIN) | §6.4 |
| H8 | Parcel inside the box in front of the sensor | §6.5 |

## 🖥️ Website screenshots to take
| # | Screen | Goes in |
|---|---|---|
| W1 | Admin dashboard (3D locker wall, stats, weekly chart) | §6.1 |
| W2 | Orders table + device event log | §6.1 |
| W3 | Delivery portal – Order ID / student lookup | §6.2 |
| W4 | Delivery portal – unlock / close-door steps | §6.2 |
| W5 | Notification banner | §6.3 |
| W6 | Student pickup page with live PIN dots | §6.4 |
| W7 | Firebase console database tree (`orders`, `boxes/B01`, `events`) | §6.6 |
| — | Existing `image.png` flowchart | §3.1 |
| — | Arduino Serial Monitor output (optional) | §5.3 |
