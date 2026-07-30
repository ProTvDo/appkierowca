// Ustalanie, na jaki adres wysłać powiadomienie danej firmy.
//
// Konto nadawcze jest wspólne (jedno SMTP dla całej aplikacji), ale adresat
// musi należeć do firmy — inaczej podsumowania wyjazdów i zgłoszenia usterek
// wszystkich przewoźników trafiałyby do jednej skrzynki.
//
// Kolejność zastępowania jest celowa: lepiej wysłać do biura firmy niż nie
// wysłać wcale, i lepiej wysłać do ProTvDo niż zgubić zgłoszenie po cichu.

const db = require('../db');

/**
 * @param {number|string} firmaId
 * @param {'biuro'|'serwis'} rodzaj
 * @returns {Promise<{adres: string|null, powod: string|null}>}
 *   adres = null oznacza, że nie ma gdzie wysłać; powod wyjaśnia dlaczego,
 *   żeby aplikacja mogła powiedzieć kierowcy prawdę zamiast udawać sukces.
 */
async function adresatFirmy(firmaId, rodzaj) {
  const globalny = rodzaj === 'serwis'
    ? (process.env.EMAIL_MISTRZ || process.env.EMAIL_BIURO)
    : process.env.EMAIL_BIURO;

  let firma = null;
  try {
    const { rows } = await db.query(
      'SELECT email_biuro, email_serwis, kontakt_email FROM firmy WHERE id = $1',
      [firmaId]
    );
    firma = rows[0] || null;
  } catch {
    // Brak dostępu do firmy nie może wywrócić wysyłki — spadamy na globalny.
  }

  const wybor = [];
  if (rodzaj === 'serwis') wybor.push(firma?.email_serwis);
  wybor.push(firma?.email_biuro, firma?.kontakt_email, globalny);

  const adres = wybor.map(a => (a || '').trim()).find(Boolean) || null;

  if (!adres) {
    return { adres: null, powod: 'Firma nie ma ustawionego adresu e-mail' };
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { adres: null, powod: 'Poczta nie jest skonfigurowana' };
  }
  return { adres, powod: null };
}

module.exports = { adresatFirmy };
