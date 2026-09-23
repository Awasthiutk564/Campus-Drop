/*
  ==============================================================================
  CampusDrop - Smart Campus Delivery Box ESP32 Firmware
  ==============================================================================
  Hardware:
    - Microcontroller: ESP32-WROOM-32 / NodeMCU ESP32
    - Lock Actuator: SG90 / MG996R Servo Motor (Lock: 0 deg, Unlock: 90 deg)
    - Parcel Sensor: HC-SR04 Ultrasonic Sensor or TCRT5000 IR Sensor
    - Door Sensor: Magnetic Reed Switch (Door open/closed)
    - Keypad: 4x4 or 3x4 Matrix Keypad (Physical PIN entry)
    - Display: 0.96" SSD1306 I2C OLED (128x64) or 1602 I2C LCD
    - Status Indicator: RGB LED or NeoPixel (WS2812B)
  ==============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>      // Library: ArduinoJson by Benoit Blanchon
#include <ESP32Servo.h>       // Library: ESP32Servo by Kevin Harrington
#include <Wire.h>
#include <Adafruit_GFX.h>     // Library: Adafruit GFX Library
#include <Adafruit_SSD1306.h> // Library: Adafruit SSD1306
#include <Keypad.h>           // Library: Keypad by Mark Stanley

// ================= Network Configuration =================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST   = "http://192.168.1.50:3000"; // IP address of CampusDrop Node.js server
const char* BOX_ID        = "B01";                      // Smart Box ID

// ================= Pin Assignments =================
#define SERVO_PIN         13  // SG90/MG996R Servo signal PWM
#define DOOR_SENSOR_PIN   15  // Reed switch to GND (INPUT_PULLUP)
#define IR_SENSOR_PIN     19  // TCRT5000 Digital Out or Ultrasonic
#define TRIG_PIN          5   // HC-SR04 Trigger (Optional)
#define ECHO_PIN          18  // HC-SR04 Echo (Optional)

// RGB Status LED Pins (Active HIGH or common cathode)
#define LED_RED_PIN       4
#define LED_GREEN_PIN     16
#define LED_BLUE_PIN      17

// I2C OLED Pins
#define OLED_SDA          21
#define OLED_SCL          22
#define SCREEN_WIDTH      128
#define SCREEN_HEIGHT     64
#define OLED_RESET        -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// 4x4 Keypad Setup
const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {12, 14, 27, 26}; // Connect to row pinouts
byte colPins[COLS] = {25, 33, 32, 23}; // Connect to col pinouts
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// ================= Peripherals & State =================
Servo boxServo;
bool isLocked = true;
bool parcelPresent = false;
String enteredPin = "";
unsigned long lastHeartbeat = 0;
unsigned long unlockTimestamp = 0;
const unsigned long AUTO_LOCK_DELAY = 20000; // Auto-lock door after 20 seconds

void setLedColor(int r, int g, int b) {
  analogWrite(LED_RED_PIN, r);
  analogWrite(LED_GREEN_PIN, g);
  analogWrite(LED_BLUE_PIN, b);
}

void showMessage(const char* line1, const char* line2, const char* line3 = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("CampusDrop - Box #01"));
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  display.setCursor(0, 18);
  display.setTextSize(1);
  display.println(line1);

  display.setCursor(0, 34);
  display.setTextSize(2);
  display.println(line2);

  if (strlen(line3) > 0) {
    display.setCursor(0, 54);
    display.setTextSize(1);
    display.println(line3);
  }
  display.display();
}

void unlockDoor() {
  Serial.println("[ACTUATOR] Unlocking Servo (90 deg)...");
  boxServo.write(90);
  isLocked = false;
  unlockTimestamp = millis();
  setLedColor(0, 0, 255); // Blue = Door Open
  showMessage("STATUS: UNLOCKED", "DOOR OPEN", "Close after use");
}

void lockDoor() {
  Serial.println("[ACTUATOR] Locking Servo (0 deg)...");
  boxServo.write(0);
  isLocked = true;
  if (parcelPresent) {
    setLedColor(255, 120, 0); // Orange = Parcel Inside
    showMessage("STATUS: SECURE", "PARCEL IN", "Waiting for pickup");
  } else {
    setLedColor(0, 255, 0);   // Green = Ready / Free
    showMessage("STATUS: READY", "BOX EMPTY", "Scan QR to deliver");
  }
}

// Distance measurement using HC-SR04
float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 26000);
  if (duration == 0) return 999.0;
  return duration * 0.034 / 2.0;
}

// Send sensor update to server
void reportSensorToServer(bool present, float distance) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(SERVER_HOST) + "/api/boxes/" + BOX_ID + "/sensor";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["parcelPresent"] = present;
  doc["distanceCm"] = distance;

  String body;
  serializeJson(doc, body);
  int httpCode = http.POST(body);
  Serial.printf("[HTTP] Sensor report status: %d\n", httpCode);
  http.end();
}

// Check PIN with server
bool verifyPinWithServer(String pin) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  String url = String(SERVER_HOST) + "/api/boxes/" + BOX_ID;
  http.begin(url);
  int code = http.GET();

  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, resp);
    JsonObject activeOrder = doc["activeOrder"];
    if (!activeOrder.isNull()) {
      String expectedPin = activeOrder["pin"].as<String>();
      String orderId = activeOrder["id"].as<String>();
      http.end();

      // Post PIN verification request
      HTTPClient verifyHttp;
      verifyHttp.begin(String(SERVER_HOST) + "/api/orders/verify-pin");
      verifyHttp.addHeader("Content-Type", "application/json");
      StaticJsonDocument<128> vDoc;
      vDoc["orderId"] = orderId;
      vDoc["pin"] = pin;
      String vBody;
      serializeJson(vDoc, vBody);
      int vCode = verifyHttp.POST(vBody);
      verifyHttp.end();

      return (vCode == 200);
    }
  }
  http.end();
  return false;
}

// Poll server for incoming unlock/lock commands
void checkRemoteCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(SERVER_HOST) + "/api/boxes/" + BOX_ID;
  http.begin(url);
  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, payload);
    bool serverLocked = doc["locked"].as<bool>();
    if (!serverLocked && isLocked) {
      unlockDoor();
    } else if (serverLocked && !isLocked && (millis() - unlockTimestamp > 5000)) {
      lockDoor();
    }
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== CampusDrop Smart Box Initializing ===");

  // Pin modes
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(IR_SENSOR_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_BLUE_PIN, OUTPUT);

  // Initialize OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[OLED] SSD1306 allocation failed"));
  } else {
    display.clearDisplay();
    display.display();
  }

  // Initialize Servo
  boxServo.attach(SERVO_PIN);
  lockDoor();

  // Connect WiFi
  showMessage("WIFI CONNECTING", "SEARCHING...", WIFI_SSID);
  setLedColor(255, 255, 0); // Yellow = Connecting

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    setLedColor(0, 255, 0);
    showMessage("SYSTEM ONLINE", "READY", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Failed to connect. Running in offline kiosk mode.");
    setLedColor(255, 0, 0);
    showMessage("OFFLINE MODE", "CHECK WIFI", "Keypad only");
  }
  delay(1500);
  lockDoor();
}

void loop() {
  // 1. Read Physical Keypad
  char key = keypad.getKey();
  if (key) {
    Serial.print("[KEYPAD] Pressed: "); Serial.println(key);
    if (key == '#') {
      // Submit PIN
      if (enteredPin.length() >= 4) {
        showMessage("VERIFYING...", enteredPin.c_str());
        bool ok = verifyPinWithServer(enteredPin);
        if (ok) {
          setLedColor(0, 255, 0);
          showMessage("PIN CORRECT!", "UNLOCKED", "Please take parcel");
          unlockDoor();
        } else {
          setLedColor(255, 0, 0);
          showMessage("INVALID PIN", "TRY AGAIN", "Use last 4 digits");
          delay(2000);
          lockDoor();
        }
      }
      enteredPin = "";
    } else if (key == '*') {
      // Clear PIN
      enteredPin = "";
      showMessage("ENTER PIN:", "----");
    } else if (isDigit(key) && enteredPin.length() < 4) {
      enteredPin += key;
      String masked = "";
      for (int i = 0; i < enteredPin.length(); i++) masked += "*";
      showMessage("ENTER PIN:", masked.c_str());
    }
  }

  // 2. Read Parcel Sensor (Ultrasonic or IR)
  float dist = readDistanceCm();
  bool currentlyDetected = (dist < 18.0) || (digitalRead(IR_SENSOR_PIN) == LOW);
  if (currentlyDetected != parcelPresent) {
    parcelPresent = currentlyDetected;
    Serial.printf("[SENSOR] Parcel state changed: %s (dist: %.1f cm)\n", parcelPresent ? "PRESENT" : "EMPTY", dist);
    reportSensorToServer(parcelPresent, dist);
    if (isLocked) {
      setLedColor(parcelPresent ? 255 : 0, parcelPresent ? 120 : 255, 0);
    }
  }

  // 3. Auto-Lock Safety Timer
  if (!isLocked && (millis() - unlockTimestamp > AUTO_LOCK_DELAY)) {
    Serial.println("[AUTO-LOCK] Timeout reached. Locking door.");
    lockDoor();
  }

  // 4. Poll Server Heartbeat & Remote Commands every 3 seconds
  if (millis() - lastHeartbeat > 3000) {
    lastHeartbeat = millis();
    checkRemoteCommands();
  }

  delay(20);
}
