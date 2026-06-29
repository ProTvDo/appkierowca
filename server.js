const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes    = require('./routes/auth');
const grafikRoutes  = require('./routes/grafik');
const usterkiRoutes = require('./routes/usterki');
const kontaktyRoutes = require('./routes/kontakty');

const app = express();

app.use(cors({
  origin: ['https://appkierowcagdynia.netlify.app', 'http://localhost:5174', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// ── routes ──
app.use('/api/auth',     authRoutes);
app.use('/api/grafik',   grafikRoutes);
app.use('/api/usterki',  usterkiRoutes);
app.use('/api/kontakty', kontaktyRoutes);

// ── health check ──
app.get('/api/ping', (req, res) => res.json({ ok: true, czas: new Date() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KierowcaApp API działa na porcie ${PORT}`));
