// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');

navToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

navLinks?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// Version tabs (Wersje)
const versionTabs = document.querySelectorAll('.version-tab');
const versionPanels = document.querySelectorAll('.version-panel');

versionTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.version;

    versionTabs.forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    versionPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.version === target);
    });
  });
});

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealEls.forEach((el) => observer.observe(el));

// Contact form — wysyłka przez wyslij.php (serwer musi obsługiwać PHP)
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');
const formSubmitBtn = contactForm?.querySelector('button[type="submit"]');

contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  formStatus.textContent = '';
  formStatus.className = 'form-status';
  formSubmitBtn.disabled = true;
  formSubmitBtn.textContent = 'Wysyłanie...';

  try {
    const dane = new FormData(contactForm);
    const odpowiedz = await fetch('wyslij.php', { method: 'POST', body: dane });
    const wynik = await odpowiedz.json();

    if (wynik.ok) {
      formStatus.textContent = '✅ Wiadomość wysłana — odpowiemy w ciągu 24 godzin.';
      formStatus.classList.add('ok');
      contactForm.reset();
    } else {
      throw new Error(wynik.error || 'Błąd wysyłki');
    }
  } catch (err) {
    formStatus.textContent = `❌ Nie udało się wysłać. Napisz bezpośrednio na kontakt@appkierowca.pl`;
    formStatus.classList.add('error');
  } finally {
    formSubmitBtn.disabled = false;
    formSubmitBtn.textContent = 'Wyślij zapytanie';
  }
});
