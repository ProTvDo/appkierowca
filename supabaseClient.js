const { createClient } = require('@supabase/supabase-js');

// Klient z service_role — tylko na serwerze, nigdy w przeglądarce
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
