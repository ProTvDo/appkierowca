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
const protokolyRoutes = require('./routes/protokoly');

const app = express();

// Za nginx i Cloudflare — bez tego req.ip byłby adresem serwera pośredniczącego,
// a ogranicznik prób logowania traktowałby wszystkich użytkowników jak jednego.
app.set('trust proxy', 1);

// Nie ogłaszamy, na czym stoi aplikacja.
app.disable('x-powered-by');

// Nagłówki ochronne. Aplikacja jest osobnym originem, więc ustawiamy je tutaj,
// a nie liczymy na Cloudflare — ten dokłada swoje tylko do części odpowiedzi.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');            // brak osadzania w ramce
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // Odpowiedzi API nie mogą trafiać do pamięci podręcznej — zawierają dane firmy.
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
app.use('/api/protokoly', protokolyRoutes);

// ── health check ──
app.get('/api/ping', (req, res) => res.json({ ok: true, czas: new Date() }));

// Ostatnia zapora: cokolwiek nieprzewidzianego wyleci wyżej, klient dostaje
// komunikat ogólny. Treść błędu bazy ujawniałaby nazwy tabel i kolumn.
app.use((err, req, res, _next) => {
  console.error('Nieobsłużony błąd:', err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Błąd serwera' });
});

// Awaria połączenia z bazą nie może wywrócić całego procesu — pg emituje
// 'error' na bezczynnych klientach, a nieobsłużone zdarzenie kończy Node.
require('./db').on('error', e => console.error('Błąd puli PostgreSQL:', e.message));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`KierowcaApp API działa na porcie ${PORT}`));
