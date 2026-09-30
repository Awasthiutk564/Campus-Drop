/*
  CampusDrop — ESP8266 (NodeMCU) network + keypad board for Smart Box 01

  - Connects to WiFi and talks to Firebase Realtime Database over HTTPS (REST API)
  - Reads the 4x4 keypad, mirrors typed digits to the website, verifies the PIN
  - Sends LOCK / UNLOCK / LCD commands to the Arduino UNO over serial and reports
    the UNO's ultrasonic readings back to Firebase

  Keypad wiring (IMPORTANT: R1 and C4 are swapped compared with the first build,
  because D0/GPIO16 has no internal pull-up and cannot be a keypad row):
      R1 → D1   R2 → D3   R3 → D4   R4 → D5
      C1 → D6   C2 → D7   C3 → D8   C4 → D0
  Don't hold a key down while the board powers up (D3, D4, D8 are boot pins).

  Serial to the UNO uses the ESP8266's own TX/RX pins at 9600 baud, which are also its
  USB port: unplug the RX wire while uploading. Debug lines start with '#' so the UNO
  ignores them, and you can still read them in the Serial Monitor.

  Firebase paths used (same as index.html):
    boxes/B01          heartbeat, lock state, sensor, keypad mirror, currentOrder, command, commandAck
    orders/{orderId}   status → "collected", collectedAt, attempts, lockedUntil
    events/{pushId}    device log shown on the dashboard

  Board: "NodeMCU 1.0 (ESP-12E Module)" from the esp8266 core
         (Boards Manager URL: https://arduino.esp8266.com/stable/package_esp8266com_index.json)
  Libraries: Keypad by Mark Stanley, ArduinoJson by Benoit Blanchon (v7)
*/
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <ArduinoJson.h>
#include <Keypad.h>
#include <time.h>

// ================= Settings =================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
// Realtime Database host from the Firebase console, without https:// and without a trailing slash.
const char* FIREBASE_HOST = "YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app";
// Optional: a database secret (Project settings → Service accounts → Database secrets).
// Leave empty while the database rules allow open access.
const char* FIREBASE_AUTH = "";
const char* BOX_ID        = "B01";

const unsigned long COMMAND_POLL_MS   = 1000;   // how often to check for website commands
const unsigned long HEARTBEAT_MS      = 10000;  // website marks the box offline after 30 s
const unsigned long PIN_OPEN_MS       = 15000;  // auto-lock after a PIN unlock
const unsigned long REMOTE_OPEN_MS    = 60000;  // safety auto-lock if the website never sends LOCK
const unsigned long KEYPAD_SYNC_MS    = 200;    // batch fast typing into one Firebase write
const unsigned long LOCKOUT_MS        = 30000;  // after every 5 wrong PINs
const byte          MAX_ATTEMPTS      = 5;

// ================= Keypad =================
const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {D1, D3, D4, D5};
byte colPins[COLS] = {D6, D7, D8, D0};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// ================= State =================
BearSSL::WiFiClientSecure tls;
HTTPClient http;

bool locked = true;
bool parcelPresent = false;
float distanceCm = -1;
String pin;
bool keypadDirty = false;
unsigned long lastKeyAt = 0, lastPollAt = 0, lastBeatAt = 0;
unsigned long unlockedAt = 0, openMs = 0, lockoutUntil = 0;
String lastCommandId;
bool commandSeen = false;
bool unoAck = false;
String unoLine;

#define DBG(x) do { Serial.print(F("# ")); Serial.println(x); } while (0)

// ================= Firebase REST =================
String fbUrl(const String& path) {
  String url = String("https://") + FIREBASE_HOST + "/" + path + ".json";
  if (FIREBASE_AUTH[0]) url += String("?auth=") + FIREBASE_AUTH;
  return url;
}

// method: GET / PUT / PATCH / POST. Returns the HTTP code (<= 0 on network error).
int fb(const char* method, const String& path, const String& body = "", String* out = nullptr) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  http.setReuse(true);
  if (!http.begin(tls, fbUrl(path))) return -1;
  http.addHeader("Content-Type", "application/json");
  int code = http.sendRequest(method, body);
  if (out && code > 0) *out = http.getString();
  http.end();
  if (code != 200) { DBG(String(method) + " " + path + " -> " + code); }
  return code;
}

String boxPath(const char* sub = nullptr) {
  String p = String("boxes/") + BOX_ID;
  if (sub) { p += "/"; p += sub; }
  return p;
}

const char* SERVER_TIME = "{\".sv\":\"timestamp\"}";

void logEvent(const char* action, const String& payloadJson) {
  String body = String("{\"t\":") + SERVER_TIME + ",\"dir\":\"in\",\"boxId\":\"" + BOX_ID +
                "\",\"action\":\"" + action + "\",\"payload\":" + payloadJson + "}";
  fb("POST", "events", body);
}

// Epoch milliseconds as a string (NTP), or "" if the clock isn't set yet.
String epochMsPlus(unsigned long addMs) {
  time_t now = time(nullptr);
  if (now < 1600000000) return "";
  return String((unsigned long)(now + addMs / 1000)) + "000";
}

// ================= UNO link =================
void handleUnoLine(String l) {
  l.trim();
  if (l.startsWith("ACK:")) { unoAck = true; return; }
  if (l.startsWith("PARCEL:") || l.startsWith("STATE:")) {
    // PARCEL:<p>:<cm>   STATE:<locked>:<p>:<cm>
    bool isState = l.startsWith("STATE:");
    int a = l.indexOf(':'), b = l.indexOf(':', a + 1);
    if (isState) { a = b; b = l.indexOf(':', a + 1); }
    if (a < 0 || b < 0) return;
    bool present = l.substring(a + 1, b) == "1";
    distanceCm = l.substring(b + 1).toFloat();
    bool changed = present != parcelPresent;
    parcelPresent = present;
    if (changed || !isState) {
      fb("PATCH", boxPath(), String("{\"parcelPresent\":") + (parcelPresent ? "true" : "false") +
                            ",\"distanceCm\":" + String(distanceCm, 1) + "}");
      logEvent("ultrasonic.sensor", String("{\"parcel\":") + (parcelPresent ? "true" : "false") +
                                    ",\"distanceCm\":" + String(distanceCm, 1) + "}");
      showIdle();
    }
  }
}

void readUno() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { handleUnoLine(unoLine); unoLine = ""; }
    else if (c != '\r' && unoLine.length() < 64) unoLine += c;
  }
}

// Sends LOCK/UNLOCK and waits up to 1.5 s for the UNO's ACK.
bool unoCommand(const char* cmd) {
  unoAck = false;
  Serial.println(cmd);
  unsigned long t = millis();
  while (!unoAck && millis() - t < 1500) { readUno(); delay(5); }
  if (!unoAck) DBG(String("UNO did not ACK ") + cmd);
  return unoAck;
}

void lcd(const String& l1, const String& l2) {
  Serial.print("LCD:"); Serial.print(l1); Serial.print('|'); Serial.println(l2);
}

void showIdle() {
  if (!locked) return;
  if (millis() < lockoutUntil) { lcd("Too many tries", "Wait 30 seconds"); return; }
  if (pin.length()) {
    String stars; for (unsigned i = 0; i < pin.length(); i++) stars += '*';
    lcd("Enter PIN:", stars);
  } else if (parcelPresent) lcd("Parcel inside", "Enter PIN:");
  else lcd(String("CampusDrop ") + BOX_ID, "Box is empty");
}

// ================= Lock control =================
void setLocked(bool lock, const char* reason, unsigned long autoLockMs = 0) {
  unoCommand(lock ? "LOCK" : "UNLOCK");
  locked = lock;
  if (!lock) { unlockedAt = millis(); openMs = autoLockMs; }
  fb("PATCH", boxPath(), String("{\"locked\":") + (lock ? "true" : "false") +
                         ",\"servoAngle\":" + (lock ? 0 : 90) + "}");
  logEvent(lock ? "servo.lock" : "servo.unlock", String("{\"reason\":\"") + reason + "\"}");
  if (lock) showIdle();
  else if (strcmp(reason, "pin_verified") == 0) lcd("Door unlocked", "Take your parcel");
  else lcd("Door unlocked", "Close when done");
}

// ================= Website commands =================
void pollCommand() {
  String body;
  if (fb("GET", boxPath("command"), "", &body) != 200) return;
  if (body == "null") { commandSeen = true; return; }
  JsonDocument doc;
  if (deserializeJson(doc, body)) return;
  String id = doc["id"] | "";
  String action = doc["action"] | "";
  if (id.length() == 0 || id == lastCommandId) return;
  lastCommandId = id;
  // The first command we see after booting is old; acknowledge it without acting on it.
  if (!commandSeen) {
    commandSeen = true;
    fb("PUT", boxPath("commandAck"), "\"" + id + "\"");
    return;
  }
  DBG("command " + action + " " + id);
  if (action == "unlock") setLocked(false, "website", REMOTE_OPEN_MS);
  else if (action == "lock") setLocked(true, "website");
  fb("PUT", boxPath("commandAck"), "\"" + id + "\"");
}

// ================= PIN =================
String currentOrderAttemptsPath(const String& orderId) { return "orders/" + orderId + "/attempts"; }

void verifyPin() {
  fb("PUT", boxPath("keypad"), "\"" + pin + "\"");
  keypadDirty = false;
  lcd("Checking PIN...", "");

  String body;
  if (fb("GET", boxPath("currentOrder"), "", &body) != 200) {
    lcd("Network error", "Try again");
    pin = ""; fb("PUT", boxPath("keypad"), "\"\"");
    delay(1500); showIdle(); return;
  }
  body.trim();
  if (body == "null" || body.length() < 6) {
    lcd("No parcel for", "this box");
    logEvent("pin.rejected", "{\"reason\":\"no_order\"}");
    pin = ""; fb("PUT", boxPath("keypad"), "\"\"");
    delay(1500); showIdle(); return;
  }
  String orderId = body.substring(1, body.length() - 1);  // strip quotes
  String expected = orderId.substring(orderId.length() - 4);
  String entered = pin;
  pin = "";

  if (entered == expected) {
    // Order collected + box unlocked in one atomic multi-path update.
    fb("PATCH", "", String("{") +
        "\"orders/" + orderId + "/status\":\"collected\"," +
        "\"orders/" + orderId + "/collectedAt\":" + SERVER_TIME + "," +
        "\"boxes/" + BOX_ID + "/currentOrder\":null," +
        "\"boxes/" + BOX_ID + "/keypad\":\"\"}");
    logEvent("pin.accepted", "{\"order\":\"" + orderId + "\"}");
    lcd("PIN correct!", "Opening...");
    setLocked(false, "pin_verified", PIN_OPEN_MS);
    return;
  }

  String attemptsBody;
  int attempts = 0;
  if (fb("GET", currentOrderAttemptsPath(orderId), "", &attemptsBody) == 200) attempts = attemptsBody.toInt();
  attempts++;
  String patch = String("{\"orders/") + orderId + "/attempts\":" + attempts +
                 ",\"boxes/" + BOX_ID + "/keypad\":\"\"";
  bool lockout = attempts % MAX_ATTEMPTS == 0;
  if (lockout) {
    lockoutUntil = millis() + LOCKOUT_MS;
    String until = epochMsPlus(LOCKOUT_MS);
    if (until.length()) patch += ",\"orders/" + orderId + "/lockedUntil\":" + until;
  }
  patch += "}";
  fb("PATCH", "", patch);
  logEvent("pin.rejected", String("{\"attempts\":") + attempts + "}");
  if (lockout) lcd("Too many tries", "Wait 30 seconds");
  else lcd("Wrong PIN", String(MAX_ATTEMPTS - attempts % MAX_ATTEMPTS) + " tries left");
  delay(1500);
  showIdle();
}

void handleKey(char k) {
  if (!locked || millis() < lockoutUntil) return;
  if (k >= '0' && k <= '9') { if (pin.length() < 4) pin += k; }
  else if (k == '*') pin = "";
  else if (k == '#') { if (pin.length()) pin.remove(pin.length() - 1); }
  else return;  // A-D unused
  keypadDirty = true;
  lastKeyAt = millis();
  showIdle();
  if (pin.length() == 4) verifyPin();
}

// ================= Heartbeat =================
void heartbeat() {
  Serial.println("STATUS");  // UNO answers with STATE:..., handled in readUno()
  fb("PATCH", boxPath(), String("{\"online\":true,\"lastSeen\":") + SERVER_TIME +
                         ",\"locked\":" + (locked ? "true" : "false") +
                         ",\"servoAngle\":" + (locked ? 0 : 90) +
                         ",\"parcelPresent\":" + (parcelPresent ? "true" : "false") +
                         ",\"distanceCm\":" + String(distanceCm, 1) +
                         ",\"ip\":\"" + WiFi.localIP().toString() + "\"" +
                         ",\"rssi\":" + WiFi.RSSI() + "}");
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lcd("Connecting WiFi", WIFI_SSID);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) { delay(250); readUno(); }
  if (WiFi.status() == WL_CONNECTED) { DBG("WiFi " + WiFi.localIP().toString()); lcd("WiFi connected", WiFi.localIP().toString()); }
  else { DBG("WiFi failed, will keep retrying"); lcd("WiFi failed", "Retrying..."); }
}

void setup() {
  Serial.begin(9600);
  delay(300);
  tls.setInsecure();  // prototype: skip certificate check
  http.setTimeout(5000);
  connectWiFi();
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  unoCommand("LOCK");
  locked = true;
  Serial.println("STATUS");
  delay(200); readUno();
  fb("PATCH", boxPath(), "{\"keypad\":\"\",\"locked\":true,\"servoAngle\":0}");
  heartbeat();
  lastBeatAt = millis();
  logEvent("device.boot", "{\"board\":\"esp8266+uno\"}");
  showIdle();
}

void loop() {
  readUno();

  char k = keypad.getKey();
  if (k) handleKey(k);

  unsigned long now = millis();
  // Mirror typed digits to the website once typing pauses (keeps key scanning responsive).
  if (keypadDirty && now - lastKeyAt > KEYPAD_SYNC_MS) {
    keypadDirty = false;
    fb("PUT", boxPath("keypad"), "\"" + pin + "\"");
  }
  bool typing = now - lastKeyAt < 1500;

  if (!locked && openMs && now - unlockedAt > openMs) setLocked(true, "auto");
  if (!typing && now - lastPollAt > COMMAND_POLL_MS) { lastPollAt = now; pollCommand(); }
  if (!typing && now - lastBeatAt > HEARTBEAT_MS) { lastBeatAt = now; heartbeat(); }
  if (lockoutUntil && now >= lockoutUntil) { lockoutUntil = 0; showIdle(); }
}
