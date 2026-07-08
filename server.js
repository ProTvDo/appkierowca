const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes    = require('./routes/auth');
const grafikRoutes  = require('./routes/grafik');
const usterkiRoutes = require('./routes/usterki');
const kontaktyRoutes = require('./routes/kontakty');
const szkoleniaRoutes = require('./routes/szkolenia');
const wyjazdyRoutes = require('./routes/wyjazdy');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors({
  origin: ['https://appkierowca.netlify.app', 'https://appkierowcagdynia.netlify.app', 'http://localhost:5174', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// ── routes ──
app.use('/api/auth',     authRoutes);
app.use('/api/grafik',   grafikRoutes);
app.use('/api/usterki',  usterkiRoutes);
app.use('/api/kontakty', kontaktyRoutes);
app.use('/api/szkolenia', szkoleniaRoutes);
app.use('/api/wyjazdy', wyjazdyRoutes);
app.use('/api/admin', adminRoutes);

// ── health check ──
app.get('/api/ping', (req, res) => res.json({ ok: true, czas: new Date() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KierowcaApp API działa na porcie ${PORT}`));
