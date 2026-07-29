const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.kierowca = payload; // { id, nr_sluzbowy, imie, nazwisko }
    next();
  } catch {
    return res.status(401).json({ error: 'Token nieważny lub wygasł' });
  }
};
