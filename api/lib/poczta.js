// Jeden transport pocztowy dla całej aplikacji.
//
// Wcześniej każda trasa tworzyła własny, z powtórzoną konfiguracją — a różnice
// między nimi trudno było zauważyć. Najważniejsza jest tu requireTLS: na porcie
// 587 połączenie zaczyna się nieszyfrowane i przechodzi na TLS przez STARTTLS.
// Bez tego wymogu nodemailer w razie niepowodzenia STARTTLS wysłałby login
// i hasło otwartym tekstem, nie zgłaszając żadnego błędu.

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:       process.env.SMTP_HOST || 'localhost',
  port:       parseInt(process.env.SMTP_PORT) || 587,
  secure:     false,   // 587 to STARTTLS, nie SMTPS (to jest port 465)
  requireTLS: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

/** Nadawca — zawsze konto aplikacji, żeby zgadzało się z SPF domeny. */
function nadawca() {
  return `"KierowcaApp" <${process.env.SMTP_USER}>`;
}

module.exports = { transporter, nadawca };
