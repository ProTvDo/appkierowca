const { Pool, types } = require('pg');

// DATE i TIME jako surowe stringi, nie obiekty Date — konwersja stref czasowych
// potrafi przesunąć datę o dzień, a grafik i data wyjazdu muszą pozostać
// dokładnie tym, co wpisała firma (np. "2026-08-01").
types.setTypeParser(1082, val => val); // date
types.setTypeParser(1083, val => val); // time

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'kierowcaapp',
  user:     process.env.DB_USER || 'kierowcaapp_user',
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
