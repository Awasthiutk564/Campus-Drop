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
  // Disable Firebase temporarily: the app uses its local, no-account demo mode
  // while the database authentication setup is being sorted out.
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "campusdrop-312a5",
  storageBucket: "campusdrop-312a5.firebasestorage.app",
  messagingSenderId: "1006083398375",
  appId: "1:1006083398375:web:b8e83c88aa1a561787a042"
};


// App Check: paste the reCAPTCHA Enterprise site key (Google Cloud console → Security → reCAPTCHA).
// Leave as-is to keep App Check off.
window.CAMPUSDROP_APPCHECK_SITE_KEY = "";
