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
const importRoutes = require('./routes/import');
const firmyRoutes = require('./routes/firmy');

const app = express();

// Na produkcji frontend chodzi po tym samym origin (nginx przekazuje /api),
// więc CORS dotyczy tylko wejścia bezpośrednio na api.appkierowca.pl i devu.
const dozwoloneOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: dozwoloneOrigins,
  credentials: true
}));
// Domyślne 100 kB nie wystarcza na import miesięcznego grafiku — przy 40
// kierowcach to ponad tysiąc wierszy i firma dostałaby tylko "413" bez
// wyjaśnienia, co poszło nie tak.
app.use(express.json({ limit: '5mb' }));

// ── routes ──
app.use('/api/auth',     authRoutes);
app.use('/api/grafik',   grafikRoutes);
app.use('/api/usterki',  usterkiRoutes);
app.use('/api/kontakty', kontaktyRoutes);
app.use('/api/szkolenia', szkoleniaRoutes);
app.use('/api/wyjazdy', wyjazdyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/import', importRoutes);
app.use('/api/firmy', firmyRoutes);

// ── health check ──
app.get('/api/ping', (req, res) => res.json({ ok: true, czas: new Date() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`KierowcaApp API działa na porcie ${PORT}`));
