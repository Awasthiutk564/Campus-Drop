/*
  CampusDrop — Arduino UNO (box I/O board)

  Drives the parts inside the box and takes orders from the ESP8266 over serial:
    - SG90 servo lock         signal D9   (0° = locked, 90° = unlocked)
    - HC-SR04 ultrasonic      TRIG D7, ECHO D6 (parcel inside / empty)
    - 16x2 I2C LCD            SDA A4, SCL A5

  Serial link to the ESP8266 (hardware Serial, pins 0/1, 9600 baud):
    UNO TX (pin 1) ── 1kΩ ──┬── ESP8266 RX      (2kΩ to GND makes 5 V → 3.3 V)
    UNO RX (pin 0) ──────────── ESP8266 TX
    GND ─────────────────────── GND
  Unplug the wire on UNO pin 0 while uploading this sketch.

  Line protocol (one command per line, '\n' terminated):
    ESP8266 → UNO   LOCK | UNLOCK | STATUS | LCD:<line 1>|<line 2>
    UNO → ESP8266   READY | ACK:LOCK | ACK:UNLOCK | PARCEL:<0|1>:<cm> | STATE:<locked 0|1>:<parcel 0|1>:<cm>
  Lines starting with '#' are debug text from the ESP8266 and are ignored.

  Libraries: Servo (built in), LiquidCrystal I2C by Frank de Brabander.
*/
#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ================= Pins =================
#define SERVO_PIN  9
#define TRIG_PIN   7
#define ECHO_PIN   6

// ================= Tuning =================
#define LOCK_ANGLE     0
#define UNLOCK_ANGLE   90
#define LCD_ADDRESS    0x27  // most I2C backpacks; use 0x3F if the screen stays blank
// Anything closer than this counts as a parcel. Measure the empty box (see the hardware guide)
// and set this a few cm below that reading.
#define PARCEL_THRESHOLD_CM  12.0
#define SENSOR_INTERVAL_MS   250
#define STABLE_READINGS      4     // readings in a row before the parcel state flips

Servo lockServo;
LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);

bool locked = true;
bool parcelPresent = false;
float distanceCm = -1;
byte sameCount = 0;
unsigned long lastSensorAt = 0;
String line;

void lcdShow(const String& l1, const String& l2) {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(l2.substring(0, 16));
}

void setLock(bool lock) {
  lockServo.write(lock ? LOCK_ANGLE : UNLOCK_ANGLE);
  locked = lock;
  Serial.println(lock ? F("ACK:LOCK") : F("ACK:UNLOCK"));
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 25000UL);  // ~4 m max
  if (us == 0) return 400.0;                            // no echo: treat as far away
  return us * 0.0343 / 2.0;
}

void sendState() {
  Serial.print(F("STATE:")); Serial.print(locked ? 1 : 0);
  Serial.print(':');         Serial.print(parcelPresent ? 1 : 0);
  Serial.print(':');         Serial.println(distanceCm, 1);
}

void updateSensor() {
  if (millis() - lastSensorAt < SENSOR_INTERVAL_MS) return;
  lastSensorAt = millis();
  distanceCm = readDistanceCm();
  bool seen = distanceCm < PARCEL_THRESHOLD_CM;
  if (seen == parcelPresent) { sameCount = 0; return; }
  if (++sameCount < STABLE_READINGS) return;
  sameCount = 0;
  parcelPresent = seen;
  Serial.print(F("PARCEL:")); Serial.print(parcelPresent ? 1 : 0);
  Serial.print(':');          Serial.println(distanceCm, 1);
}

void handleLine(String cmd) {
  cmd.trim();
  if (cmd.length() == 0 || cmd[0] == '#') return;
  if (cmd == F("LOCK"))        setLock(true);
  else if (cmd == F("UNLOCK")) setLock(false);
  else if (cmd == F("STATUS")) sendState();
  else if (cmd.startsWith(F("LCD:"))) {
    String text = cmd.substring(4);
    int bar = text.indexOf('|');
    lcdShow(bar < 0 ? text : text.substring(0, bar), bar < 0 ? String() : text.substring(bar + 1));
  }
}

void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { handleLine(line); line = ""; }
    else if (c != '\r' && line.length() < 64) line += c;
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  lockServo.attach(SERVO_PIN);
  lockServo.write(LOCK_ANGLE);

  lcd.init();
  lcd.backlight();
  lcdShow(F("CampusDrop"), F("Starting..."));

  // Start from the real sensor state so the first report is correct.
  distanceCm = readDistanceCm();
  parcelPresent = distanceCm < PARCEL_THRESHOLD_CM;
  Serial.println(F("READY"));
  sendState();
}

void loop() {
  readSerial();
  updateSensor();
}
