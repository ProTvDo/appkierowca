const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Tokeny wydane przed rozdzieleniem firm nie niosą firma_id. Gdyby przejść
    // dalej, zapytania filtrowałyby po undefined i albo nic by nie zwracały,
    // albo — gorzej — pokazały dane cudzej firmy. Lepiej wymusić ponowne
    // logowanie; aplikacja robi to sama po odpowiedzi 401.
    if (!payload.firma_id) {
      return res.status(401).json({ error: 'Zaloguj się ponownie' });
    }

    req.kierowca = payload; // { id, nr_sluzbowy, imie, nazwisko, rola, firma_id }
    next();
  } catch {
    return res.status(401).json({ error: 'Token nieważny lub wygasł' });
  }
};
