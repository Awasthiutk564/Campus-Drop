/*
  CampusDrop Firebase settings.

  1. Firebase console → your project → Project settings → General → "Your apps" → Web app.
  2. Copy the firebaseConfig values below. databaseURL comes from Build → Realtime Database.
  3. Put the same database host (without https://) into FIREBASE_HOST in
     firmware/esp8266_campusdrop/esp8266_campusdrop.ino.

  While databaseURL still contains "YOUR_", the website runs in "This device only" mode
  (browser storage + fully simulated boxes).

  The website only uses the Realtime Database, so databaseURL and projectId are all it needs.
  The other web-app values (apiKey, appId, ...) are optional; add them from the console if you
  later turn on Authentication or other Firebase services.
*/
window.CAMPUSDROP_FIREBASE = {
  databaseURL: "https://campusdrop-80526-default-rtdb.firebaseio.com",
  projectId: "campusdrop-80526"
};
