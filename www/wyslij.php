<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Niedozwolona metoda']);
    exit;
}

function oczysc($tekst) {
    return trim(str_replace(["\r", "\n"], '', $tekst));
}

$imie      = oczysc($_POST['name'] ?? '');
$firma     = oczysc($_POST['company'] ?? '');
$email     = oczysc($_POST['email'] ?? '');
$wiadomosc = trim($_POST['message'] ?? '');

if ($imie === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Uzupełnij imię i poprawny adres e-mail']);
    exit;
}

$odbiorca = 'kontakt@appkierowca.pl';
$temat    = 'Zapytanie o AppKierowca — ' . ($firma !== '' ? $firma : $imie);

$tresc  = "Imię i nazwisko: $imie\n";
$tresc .= 'Firma: ' . ($firma !== '' ? $firma : '—') . "\n";
$tresc .= "E-mail: $email\n\n";
$tresc .= "Wiadomość:\n" . ($wiadomosc !== '' ? $wiadomosc : '—') . "\n";

$naglowki  = "From: AppKierowca <kontakt@appkierowca.pl>\r\n";
$naglowki .= "Reply-To: $email\r\n";
$naglowki .= "Content-Type: text/plain; charset=UTF-8";

$tematKodowany = '=?UTF-8?B?' . base64_encode($temat) . '?=';
$wyslano = mail($odbiorca, $tematKodowany, $tresc, $naglowki);

if ($wyslano) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Nie udało się wysłać wiadomości. Spróbuj ponownie później.']);
}
