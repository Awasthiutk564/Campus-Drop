// Local web server for development. All data now lives in Firebase Realtime Database
// (see firebase-config.js); this only serves the page so it can be opened at http://localhost:3000.
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/firebase-config.js', (req, res) => res.sendFile(path.join(__dirname, 'firebase-config.js')));

app.listen(PORT, () => console.log(`CampusDrop running at http://localhost:${PORT}`));
