// Parser CSV pod pliki, jakie realnie przychodzą od firm — czyli zapisane
// z Excela, nie wygenerowane programowo.
//
// Polski Excel domyślnie rozdziela średnikiem, dokleja BOM i potrafi zapisać
// w Windows-1250. Dwie pierwsze rzeczy obsługujemy tutaj; kodowanie trzeba
// wykryć wcześniej, przy odczycie pliku.

function wykryjSeparator(pierwszaLinia) {
  const srednikow = (pierwszaLinia.match(/;/g) || []).length;
  const przecinkow = (pierwszaLinia.match(/,/g) || []).length;
  const tabow = (pierwszaLinia.match(/\t/g) || []).length;
  if (tabow > srednikow && tabow > przecinkow) return '\t';
  return srednikow > przecinkow ? ';' : ',';
}

// Dzieli jedną linię z poszanowaniem cudzysłowów ("Kowalski, Jan" to jedno pole,
// a "" w środku pola oznacza dosłowny cudzysłów).
function podzielLinie(linia, sep) {
  const pola = [];
  let biezace = '';
  let wCudzyslowie = false;

  for (let i = 0; i < linia.length; i++) {
    const znak = linia[i];
    if (wCudzyslowie) {
      if (znak === '"') {
        if (linia[i + 1] === '"') { biezace += '"'; i++; }
        else wCudzyslowie = false;
      } else biezace += znak;
    } else if (znak === '"') {
      wCudzyslowie = true;
    } else if (znak === sep) {
      pola.push(biezace.trim());
      biezace = '';
    } else {
      biezace += znak;
    }
  }
  pola.push(biezace.trim());
  return pola;
}

// Nagłówki bywają zapisane różnie ("Numer_sluzbowy", "numer służbowy",
// "Nr sluzbowy"), więc sprowadzamy je do wspólnej postaci.
function znormalizujNaglowek(h) {
  return h
    .toLowerCase()
    .replace(/[ąàâ]/g, 'a').replace(/ć/g, 'c').replace(/[ęè]/g, 'e')
    .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/[óò]/g, 'o')
    .replace(/[śş]/g, 's').replace(/[żź]/g, 'z')
    .replace(/\(.*?\)/g, '')      // dopiski w nawiasach, np. "(tak/nie)"
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Zamienia tekst CSV na listę obiektów z znormalizowanymi kluczami.
 * Zwraca też numer wiersza w pliku, żeby błędy dało się wskazać firmie
 * dokładnie tam, gdzie są.
 */
function parsujCsv(tekst) {
  if (!tekst || !tekst.trim()) return { naglowki: [], wiersze: [] };

  const bezBom = tekst.replace(/^﻿/, '');
  const linie = bezBom.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
  if (linie.length === 0) return { naglowki: [], wiersze: [] };

  const sep = wykryjSeparator(linie[0]);
  const naglowki = podzielLinie(linie[0], sep).map(znormalizujNaglowek);

  const wiersze = [];
  for (let i = 1; i < linie.length; i++) {
    const pola = podzielLinie(linie[i], sep);
    const obiekt = {};
    naglowki.forEach((h, idx) => { if (h) obiekt[h] = (pola[idx] ?? '').trim(); });
    // +1 bo liczymy od nagłówka, +1 bo ludzie liczą wiersze od jedynki
    obiekt.__wiersz = i + 1;
    wiersze.push(obiekt);
  }

  return { naglowki, wiersze };
}

// Excel potrafi zapisać datę jako 01.08.2026 albo 1/8/2026 zamiast ISO.
function normalizujDate(wartosc) {
  if (!wartosc) return null;
  const t = wartosc.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const [, d, mies, r] = m;
    return `${r}-${String(mies).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// "6:00", "06:00:00" i "6.00" znaczą to samo.
function normalizujGodzine(wartosc) {
  if (!wartosc) return null;
  const m = wartosc.trim().match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, g, min] = m;
  if (+g > 23 || +min > 59) return null;
  return `${String(g).padStart(2, '0')}:${min}`;
}

// "tak", "Tak", "x", "1", "prawda" — firmy wpisują różnie.
function normalizujTak(wartosc) {
  if (!wartosc) return false;
  return /^(tak|t|x|1|prawda|true|yes)$/i.test(wartosc.trim());
}

module.exports = { parsujCsv, normalizujDate, normalizujGodzine, normalizujTak, znormalizujNaglowek };
