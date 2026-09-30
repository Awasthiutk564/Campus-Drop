# CampusDrop Hardware Guide (Smart Box 01)

Box 01 is the real box. It uses **two boards** connected over serial:

- **ESP8266 (NodeMCU)**: WiFi, Firebase, and the 4×4 keypad. Sketch: `esp8266_campusdrop/`
- **Arduino UNO**: SG90 servo lock, HC-SR04 ultrasonic sensor, and 16×2 I2C LCD. Sketch: `uno_campusdrop/`

Boxes 02–06 on the website are simulated.

---

## 1. Components

| Part | Connected to | Job |
|---|---|---|
| ESP8266 NodeMCU (ESP-12E) | WiFi | Talks to Firebase, reads the keypad, and tells the UNO what to do |
| Arduino UNO | ESP8266 over serial | Drives the servo, sensor, and LCD |
| 4×4 membrane keypad | ESP8266 | Student types the 4-digit PIN |
| SG90 micro servo | UNO D9 | Lock: 0° = locked, 90° = unlocked |
| HC-SR04 ultrasonic | UNO D7 / D6 | Checks whether a parcel is inside |
| 16×2 LCD with I2C backpack | UNO A4 / A5 | Shows status and PIN entry on the box |
| 1 kΩ + 2 kΩ resistors | UNO TX → ESP RX | Drops the UNO's 5 V signal to 3.3 V for the ESP8266 |

---

## 2. Wiring

### Keypad → ESP8266

> **Changed from the first build:** swap the **R1** and **C4** wires.
> D0 (GPIO16) has no internal pull-up resistor, and the keypad library needs one on every
> **row** pin, so row 1 (keys 1 2 3 A) never reads on D0. Column pins don't need a pull-up,
> so C4 works fine on D0.

```
4×4 KEYPAD              ESP8266
R1  ─────────────────── D1   (was D0)
R2  ─────────────────── D3
R3  ─────────────────── D4
R4  ─────────────────── D5
C1  ─────────────────── D6
C2  ─────────────────── D7
C3  ─────────────────── D8
C4  ─────────────────── D0   (was D1)
```

If you would rather not move the wires: keep R1 on D0, add a **10 kΩ resistor from D0 to 3.3 V**,
and change `rowPins`/`colPins` in the ESP8266 sketch back to `{D0, D3, D4, D5}` / `{D6, D7, D8, D1}`.

D3, D4, and D8 are pins the ESP8266 checks while it starts up. **Don't hold a key down while powering it on.**
Normal use afterwards is fine.

### HC-SR04 → UNO
```
VCC  ─── 5V
GND  ─── GND
TRIG ─── D7
ECHO ─── D6
```

### 16×2 I2C LCD → UNO
```
GND ─── GND
VCC ─── 5V
SDA ─── A4
SCL ─── A5
```
If the screen lights up but shows nothing, turn the blue contrast potentiometer on the back.
If it still shows nothing, change `LCD_ADDRESS` in the UNO sketch from `0x27` to `0x3F`.

### SG90 servo → UNO
```
RED          ─── 5V
BROWN/BLACK  ─── GND
ORANGE/YELLOW ── D9
```
An SG90 can run from the UNO's 5 V pin. If the UNO resets or the LCD flickers when the servo moves,
add a 470 µF capacitor across the servo's 5 V and GND, or give the servo its own 5 V supply
(with GND shared with the UNO).

### UNO ↔ ESP8266 (serial, 9600 baud)
```
UNO TX (pin 1) ── 1kΩ ──┬──────→ ESP8266 RX
                        │
                       2kΩ
                        │
                       GND

UNO RX (pin 0) ←──────────────── ESP8266 TX
UNO GND ──────────────────────── ESP8266 GND
```
5 V × 2k / (1k + 2k) ≈ 3.3 V, which is safe for the ESP8266. The ESP8266's 3.3 V TX signal
is read correctly by the UNO without a divider.

**Both boards share these RX/TX pins with their USB port.** When uploading a sketch:
- to the **UNO**: unplug the wire on UNO pin 0 (RX)
- to the **ESP8266**: unplug the wire on the ESP8266 RX pin

Plug the wires back in afterwards and press reset on both boards.

---

## 3. Flashing

Arduino IDE → **File → Preferences → Additional boards manager URLs**:
```
https://arduino.esp8266.com/stable/package_esp8266com_index.json
```
Then install:
- **Boards Manager:** `esp8266` by ESP8266 Community (board: *NodeMCU 1.0 (ESP-12E Module)*). The *Arduino AVR Boards* package is already there for the UNO.
- **Library Manager:** `Keypad` by Mark Stanley, `ArduinoJson` by Benoit Blanchon (v7), `LiquidCrystal I2C` by Frank de Brabander. `Servo` is built in.

1. Open `uno_campusdrop/uno_campusdrop.ino`, select *Arduino Uno*, and upload.
2. Open `esp8266_campusdrop/esp8266_campusdrop.ino` and fill in:
   - `WIFI_SSID`, `WIFI_PASSWORD` (the ESP8266 needs **2.4 GHz** WiFi)
   - `FIREBASE_HOST`: your Realtime Database URL **without** `https://` and without the trailing `/`,
     e.g. `campusdrop-1234-default-rtdb.asia-southeast1.firebasedatabase.app`
3. Select *NodeMCU 1.0 (ESP-12E Module)* and upload.

### Calibrating the parcel sensor
With the box **empty and closed**, open the Serial Monitor on the ESP8266 at 9600 baud. Every
10 s you'll see a `STATE:1:0:<cm>` line from the UNO; `<cm>` is the empty-box distance.
In the UNO sketch, set `PARCEL_THRESHOLD_CM` a few cm below that value (e.g. empty = 18 cm → 12)
and upload again.

---

## 4. How it works

```
Website (any phone/laptop)  ⇄  Firebase Realtime Database  ⇄  ESP8266  ⇄ serial ⇄  UNO → servo / LCD
                                                                  ↑                ↑
                                                               keypad         ultrasonic
```

**Drop-off (delivery person, on the website):**
1. The courier scans Box 01 and enters the order ID and student. The PIN is the last 4 digits of the order ID.
2. **Unlock door**: the website writes `boxes/B01/command = unlock`. The ESP8266 checks for it every second, tells the UNO `UNLOCK` (servo goes to 90°), and writes `commandAck`.
3. The courier places the parcel. The ultrasonic sensor sees it and the ESP8266 sets `parcelPresent: true`.
4. **Close door and register**: the servo goes back to 0°, the order is saved, `boxes/B01/currentOrder` is set, and the student sees the notification on the website.

**Pickup (student, at the box):**
1. The student types the PIN on the **physical keypad** (`*` clears, `#` deletes a digit). Each digit shows as `*` on the LCD, and as a dot on the website's Collect page in real time.
2. After the 4th digit, the ESP8266 reads `currentOrder` and compares the PIN with its last 4 digits.
3. **Correct:** the order is marked *collected*, the servo unlocks, the LCD shows "Take your parcel", and the box re-locks by itself after 15 s.
4. **Wrong:** the website shows the attempt count. After 5 wrong tries the keypad is blocked for 30 s.

**Admin (dashboard):** *Unlock remotely* opens Box 01 for a few seconds.

**Heartbeat:** the ESP8266 reports every 10 s. If the website hears nothing for 30 s, Box 01 shows **Offline**.

### Serial messages between the boards
| From → To | Message | Meaning |
|---|---|---|
| ESP → UNO | `LOCK` / `UNLOCK` | Move the servo |
| ESP → UNO | `LCD:<line1>\|<line2>` | Show text (16 characters per line) |
| ESP → UNO | `STATUS` | Ask for the current state |
| UNO → ESP | `ACK:LOCK` / `ACK:UNLOCK` | Servo moved |
| UNO → ESP | `PARCEL:<0/1>:<cm>` | Parcel appeared or disappeared |
| UNO → ESP | `STATE:<locked>:<parcel>:<cm>` | Reply to `STATUS` |
| UNO → ESP | `READY` | UNO has started |

Lines starting with `#` are ESP8266 debug messages; the UNO ignores them.

---

## 5. Troubleshooting

| Problem | Check |
|---|---|
| Box 01 shows Offline on the website | Is the ESP8266 powered and on 2.4 GHz WiFi? Is `FIREBASE_HOST` correct (no `https://`)? Open the Serial Monitor and look for `# ... -> 401` (database rules) or `-> -1` (network). |
| "Box 01 didn't respond" when unlocking | Same as above. The website waits 10 s for the ESP8266 to confirm. |
| Keys 1, 2, 3, A don't work | R1 is still on D0; see the wiring note above. |
| ESP8266 won't start or upload | Unplug the UNO's wire from ESP RX, and don't press keys while it powers on. |
| Servo moves but the UNO resets | Add a 470 µF capacitor, or give the servo its own 5 V supply. |
| LCD blank | Adjust contrast; try `LCD_ADDRESS 0x3F`. |
| Parcel never detected | Recalibrate `PARCEL_THRESHOLD_CM` (section 3). The sensor must point into the box. |
