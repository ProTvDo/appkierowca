const { Pool, types } = require('pg');

// DATE i TIME jako surowe stringi (nie obiekty Date) — unika przesunięć o dzień
// wynikających z konwersji stref czasowych, i zachowuje ten sam format co poprzednio
// zwracał Supabase (np. "2026-07-08").
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
