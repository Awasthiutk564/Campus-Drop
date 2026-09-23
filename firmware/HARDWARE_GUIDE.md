# CampusDrop Hardware Setup & Wiring Guide

This guide describes how to connect the ESP32 microcontroller, servo actuator, sensors, keypad, and display to create the physical **Smart Campus Delivery Box** corresponding to the system architecture.

---

## 1. Components Checklist

| Component | Specification | Purpose |
|---|---|---|
| **Microcontroller** | ESP32-WROOM-32 / NodeMCU ESP32 | Main controller with WiFi & GPIOs |
| **Servo Motor** | TowerPro SG90 (Micro) or MG996R (High Torque) | Lock / Unlock deadbolt mechanism (0° to 90°) |
| **Parcel Presence Sensor** | HC-SR04 Ultrasonic or TCRT5000 IR Sensor | Detects when parcel is placed inside box (< 18cm) |
| **Door Sensor** | Magnetic Reed Switch / Limit Switch | Detects physical door closure |
| **Keypad** | 4x4 or 3x4 Matrix Membrane Keypad | Direct physical PIN entry on the locker door |
| **Status Display** | 0.96" SSD1306 I2C OLED (128x64) | Shows box instructions, PIN entry, and status |
| **Status Indicator** | Common Cathode RGB LED (or WS2812 NeoPixel) | Visual feedback (Green=Free, Orange=Parcel, Blue=Open, Red=Error) |
| **Power Supply** | 5V 2A DC Adapter or Battery Pack | Powers ESP32 and Servo motor |

---

## 2. Circuit Wiring & Pinout Table

### ESP32 Pin Connections

```
                        ESP32 Dev Module
                     ┌──────────────────┐
                 3V3 ┤                  ├ GND ────── GND (Common)
                 EN  ┤                  ├ GPIO 23 ── Keypad Col 4
             GPIO 36 ┤                  ├ GPIO 22 ── OLED SCL
             GPIO 39 ┤                  ├ GPIO 21 ── OLED SDA
             GPIO 34 ┤                  ├ GPIO 19 ── IR Sensor / ECHO
             GPIO 35 ┤                  ├ GPIO 18 ── Ultrasonic ECHO
             GPIO 32 ┤                  ├ GPIO 5  ── Ultrasonic TRIG
             GPIO 33 ┤ Keypad Col 2     ├ GPIO 17 ── LED Blue
             GPIO 25 ┤ Keypad Col 1     ├ GPIO 16 ── LED Green
             GPIO 26 ┤ Keypad Row 4     ├ GPIO 4  ── LED Red
             GPIO 27 ┤ Keypad Row 3     ├ GPIO 2  ── Onboard LED
             GPIO 14 ┤ Keypad Row 2     ├ GPIO 15 ── Door Switch
             GPIO 12 ┤ Keypad Row 1     ├ GPIO 13 ── Servo PWM Signal
                 GND ┤ GND              ├ GND
                 VIN ┤ +5V Power In     ├ 5V (from regulator)
                     └──────────────────┘
```

### Detailed Connections

#### 1. Servo Motor (SG90 / MG996R)
- **Red wire (VCC)**: Connect to external +5V power supply (Do not power high-current servos directly from ESP32 3.3V pin).
- **Brown/Black wire (GND)**: Common Ground with ESP32.
- **Orange/Yellow wire (Signal PWM)**: Connect to **GPIO 13**.

#### 2. HC-SR04 Ultrasonic Distance Sensor
- **VCC**: +5V
- **GND**: GND
- **TRIG**: **GPIO 5**
- **ECHO**: **GPIO 18** (Recommended: 1kΩ / 2kΩ voltage divider from 5V Echo to 3.3V GPIO).

*Alternative:* TCRT5000 IR Sensor:
- **VCC**: 3.3V
- **GND**: GND
- **OUT (Digital)**: **GPIO 19**

#### 3. SSD1306 0.96" I2C OLED Display
- **VCC**: 3.3V
- **GND**: GND
- **SDA**: **GPIO 21**
- **SCL**: **GPIO 22**

#### 4. RGB Status LED
- **Red Pin**: 220Ω resistor &rarr; **GPIO 4**
- **Green Pin**: 220Ω resistor &rarr; **GPIO 16**
- **Blue Pin**: 220Ω resistor &rarr; **GPIO 17**
- **Cathode (Long Pin)**: GND

#### 5. 4x4 Matrix Keypad
- **Rows (R1, R2, R3, R4)**: **GPIO 12, GPIO 14, GPIO 27, GPIO 26**
- **Columns (C1, C2, C3, C4)**: **GPIO 25, GPIO 33, GPIO 32, GPIO 23**

---

## 3. How the Hardware Operates

1. **Idle State (Box Free)**:
   - Servo is at **0°** (Locked).
   - LED is **Green**.
   - OLED screen displays `CampusDrop - Box #01 / STATUS: READY`.

2. **Delivery Drop-off**:
   - Delivery partner scans the QR code on the box.
   - App calls `POST /api/boxes/B01/unlock`.
   - ESP32 receives command &rarr; Servo turns to **90°** (Unlocked).
   - LED turns **Blue** (Door open).
   - Delivery partner places parcel inside and closes door.
   - Ultrasonic/IR sensor detects distance < 18cm &rarr; reports to server `parcelPresent: true`.
   - Servo locks back to **0°**.
   - LED turns **Orange** (Parcel inside).

3. **Student Pickup**:
   - Student receives mobile notification with PIN = last 4 digits of Order ID (e.g. `9012`).
   - Student approaches Box #01.
   - Student either enters PIN on the web app or directly on the physical keypad (`9012#`).
   - Server or ESP32 verifies the PIN:
     - **Match**: Servo turns to **90°**, LED turns Blue, student takes parcel.
     - IR sensor detects box is empty &rarr; servo locks to **0°**, LED turns Green (Ready for next parcel).
     - Status updates to `Collected`.

---

## 4. Software Dependencies in Arduino IDE

Install via Arduino IDE **Library Manager**:
1. `ESP32Servo` by Kevin Harrington
2. `ArduinoJson` by Benoit Blanchon (Version 6.x)
3. `Adafruit GFX Library`
4. `Adafruit SSD1306`
5. `Keypad` by Mark Stanley
