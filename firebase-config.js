/*
  CampusDrop Firebase settings.

  1. Firebase console → your project → Project settings → General → "Your apps" → Web app.
  2. Copy the firebaseConfig values below. databaseURL comes from Build → Realtime Database.
  3. Put the same database host (without https://) into FIREBASE_HOST in
     firmware/esp8266_campusdrop/esp8266_campusdrop.ino.

  While databaseURL still contains "YOUR_", the website runs in "This device only" mode
  (browser storage + fully simulated boxes).
*/
window.CAMPUSDROP_FIREBASE = {
  apiKey: "AIzaSyCaryvlPfIv-5DU0TL7tCZ0cu6Hpu2n9h4",
  authDomain: "campusdrop-312a5.firebaseapp.com",
  databaseURL: "https://campusdrop-312a5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "campusdrop-312a5",
  storageBucket: "campusdrop-312a5.firebasestorage.app",
  messagingSenderId: "1006083398375",
  appId: "1:1006083398375:web:b8e83c88aa1a561787a042"
};

