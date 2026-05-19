# 🥋 Manueller Testplan & Checkliste: Kyokushin Tournament App

Dieser Testplan dient als strukturierte Anleitung für Tester, um alle Kern- und Premium-Funktionen der Kyokushin Tournament Web-App und PWA systematisch auf Herz und Nieren zu prüfen.

---

## 🛠️ Vorbereitung für den Tester
1. **Empfohlener Browser:** Google Chrome oder Microsoft Edge (für vollen PWA-Support).
2. **Stripe Testkarte für Bezahlungen:**
   * **Kartennummer:** `4242 4242 4242 4242`
   * **Ablaufdatum:** Beliebiges Datum in der Zukunft (z. B. `12/30`)
   * **CVC:** `123`
3. **Admin-Konto zum Testen:**
   * **E-Mail:** `sarah.marklowski@web.de`
   * **Passwort:** `pia1979.`

---

## 📋 Testbereich 1: Installation & PWA (Installations-Test)

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 1.1** | PWA-Installation über die Navigationsleiste | 1. Öffne die Webseite in Chrome oder Edge.<br>2. Klicke in der Navbar auf den roten Button **„App Installieren“**.<br>3. Bestätige das Pop-up des Browsers. | Die App wird nahtlos als eigenständige Desktop-App installiert und öffnet sich in einem separaten, rahmenlosen Fenster. In der Navbar verschwindet der Button. | |
| **TC 1.2** | Offline-Fähigkeit & Lade-Geschwindigkeit | 1. Schließe die PWA.<br>2. Trenne deine Internetverbindung (WLAN ausschalten).<br>3. Starte die installierte PWA über dein Desktop-Icon neu. | Die App startet sofort, lädt blitzschnell und zeigt alle zuvor geladenen Turniere offline an (dank des registrierten Service Workers). | |

---

## 📋 Testbereich 2: Benutzerkonten (Auth & Admins)

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 2.1** | Registrierung eines normalen Benutzers | 1. Klicke auf „Abmelden“ (falls eingeloggt).<br>2. Wähle „Registrieren“.<br>3. Erstelle ein neues Konto mit einer beliebigen Test-E-Mail (z. B. `tester@test.de`). | Das Konto wird erfolgreich erstellt und du wirst direkt eingeloggt. | |
| **TC 2.2** | Login & Bypass-Check des Admin-Kontos | 1. Melde dich ab.<br>2. Logge dich mit den Admin-Daten (`sarah.marklowski@web.de` / `pia1979.`) ein.<br>3. Rufe ein beliebiges Turnier auf. | Der Login gelingt sofort. Alle Bezahlschranken sind komplett deaktiviert (Admin-Modus). Alle Turniere sind ohne Ticketkauf voll editierbar. | |

---

## 📋 Testbereich 3: Turnier-Erstellung & Paywall-Flow

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 3.1** | Kostenlose Erstellung eines Turnier-Entwurfs | 1. Logge dich mit einem **normalen** (nicht-Admin) Test-Account ein.<br>2. Klicke auf **„Neues Turnier“**.<br>3. Trage Name, Datum, Ort und Mattenanzahl ein und speichere. | Das Turnier wird erfolgreich und komplett kostenlos als Entwurf angelegt. Du wirst auf die Detailseite weitergeleitet. | |
| **TC 3.2** | Sichtbarkeit der Paywall & Sperrung | 1. Öffne das neu erstellte Turnier-Entwurf als normaler Nutzer. | Du siehst den titel des Turniers, aber darunter erscheint die rote Bezahlschranke *„Dieses Turnier befindet sich im Entwurf“*. Alle Bearbeitungs-Tabs sind komplett gesperrt. | |
| **TC 3.3** | Stripe-Zahlung & automatisches Freischalten | 1. Klicke auf der Paywall bei **„Einzelticket (24 €)“** auf **„Ticket Kaufen“**.<br>2. Führe die Stripe-Zahlung mit der Testkarte durch.<br>3. Warte auf die automatische Rückleitung zur App. | Nach der Rückleitung erscheint ein Erfolgs-Pop-up. Die Seite lädt neu, die Bezahlschranke ist verschwunden und alle Tabs (Teilnehmer, etc.) sind voll einsatzbereit! | |
| **TC 3.4** | Freischaltung über vorhandene Lizenz | 1. Kaufe ein **Jahresabo (99 €)**.<br>2. Erstelle ein weiteres neues Turnier.<br>3. Nutze auf der Paywall den grünen Button **„Turnier jetzt freischalten“** (da du nun 99 Lizenzen besitzt). | Das Turnier wird sofort und ohne erneute Zahlung direkt freigeschaltet. Die verfügbaren Lizenzen verringern sich um 1. | |

---

## 📋 Testbereich 4: Teilnehmer-Verwaltung (CSV Import & Export)

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 4.1** | Manueller Eintrag eines Kämpfers | 1. Trage einen Teilnehmer manuell über das Formular ein (Name, Geburtsdatum, Verein, Gewicht, Kyu-Grad, Geschlecht). | Der Teilnehmer erscheint sofort in der Liste. | |
| **TC 4.2** | CSV-Import mit Umlauten | 1. Lade eine CSV-Testdatei mit Umlauten im Vereinsnamen oder Gürtelfarbe (z. B. *„München“, „Gürtel“*).<br>2. Klicke auf **„CSV Import“** und wähle die Datei. | Alle Teilnehmer werden sauber eingelesen. Umlaute werden korrekt importiert (keine Zeichensalat-Fehler). | |
| **TC 4.3** | CSV-Export & Excel-Kompatibilität (BOM-Test) | 1. Klicke rechts auf den goldenen Button **„CSV Export“**.<br>2. Öffne die heruntergeladene Datei direkt in Microsoft Excel oder LibreOffice. | Die Liste öffnet sich tadellos in Excel. Dank integriertem UTF-8 BOM werden alle Umlaute (*ä, ö, ü*) perfekt und lesbar angezeigt. | |
| **TC 4.4** | Anmeldung abschließen | 1. Klicke auf den grünen Button **„Anmeldung abschließen“**. | Die Registrierung wird geschlossen. Neue Teilnehmer können jetzt nicht mehr hinzugefügt werden (Schutz vor Manipulationen während des Turniers). | |

---

## 📋 Testbereich 5: Kategorien & Gewichtsklassen

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 5.1** | Automatische Alters- und Gewichtszuweisung | 1. Gehe in den Tab **„Kategorien“**.<br>2. Klicke auf **„Kategorien automatisch erstellen & zuweisen“**. | Die App teilt alle Kämpfer vollautomatisch anhand ihres Alters, Geschlechts und Gewichts in faire Gruppen ein. | |
| **TC 5.2** | Manuelle Verschiebung eines Kämpfers | 1. Klicke bei einem Teilnehmer auf das Stift-Symbol.<br>2. Verschiebe ihn manuell in eine höhere Gewichtsklasse. | Der Kämpfer wechselt sofort die Kategorie. Die Statistiken passen sich in Echtzeit an. | |
| **TC 5.3** | Zuweisung bestätigen | 1. Klicke auf **„Kategorieneinteilung bestätigen“**. | Die Einteilung wird fixiert und der Tab **„Turnierbaum“** wird freigeschaltet. | |

---

## 📋 Testbereich 6: Turnierbaum-Generierung (Brackets)

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 6.1** | Automatische Bracket-Generierung | 1. Gehe in den Tab **„Turnierbaum“**.<br>2. Klicke auf **„Turnierbäume generieren“**. | Die Turnierbäume für alle Kategorien werden generiert (KO-System bei größeren Gruppen, Gruppenmodus bei kleineren). | |
| **TC 6.2** | Ansicht & Freilose (Bye) | 1. Wähle eine Kategorie aus.<br>2. Prüfe den Turnierbaum auf Richtigkeit. | Kämpfer ohne direkten Gegner in Runde 1 erhalten automatisch ein Freilos (Bye) und rücken eine Runde vor. | |

---

## 📋 Testbereich 7: Kampfsteuerung & Live-Synchronisation

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 7.1** | Kampf starten & Punkte vergeben | 1. Gehe in den Tab **„Kampfleitung“**.<br>2. Wähle Matte 1.<br>3. Klicke bei einem geplanten Kampf auf **„Starten“**.<br>4. Vergib Punkte (Ippon, Waza-Ari) und Strafen (Chui, Gasa-Ari) für beide Kämpfer. | Der Timer läuft flüssig. Die Punkte werden sofort und fehlerfrei auf dem Dashboard addiert. | |
| **TC 7.2** | Live-Ansicht (Beamer-Test) | 1. Gehe in den Tab **„Live“**.<br>2. Öffne die Live-Ansicht für **„Matte 1“** in einem separaten Browser-Fenster.<br>3. Vergib in deinem Admin-Tab einen Punkt.<br>4. Prüfe das Live-Fenster. | Die Punkte und der Timer im Live-Fenster aktualisieren sich **vollautomatisch in Millisekunden in Echtzeit** (ohne manuelles Neuladen!). | |
| **TC 7.3** | Kampf beenden & Gewinner-Zuweisung | 1. Klicke auf **„Kampf beenden“**.<br>2. Wähle den Gewinner aus und bestätige. | Der Sieger rückt im Turnierbaum automatisch in die nächste Runde vor. Der nächste anstehende Kampf wird auf Matte 1 aufgerufen. | |

---

## 📋 Testbereich 8: Turnierende & DSGVO

| ID | Testfall (Test Case) | Schritt-für-Schritt-Anleitung | Erwartetes Ergebnis | Status (✅ / ❌) |
| :--- | :--- | :--- | :--- | :---: |
| **TC 8.1** | Finale austragen & Beendigung | 1. Trage alle ausstehenden Kämpfe der Kategorien aus.<br>2. Führe das Finale der letzten Kategorie durch und beende es. | Das Turnier wird automatisch als **„Beendet“** markiert. Eine grüne Infobox erscheint. | |
| **TC 8.2** | Ergebnisse-Export (Siegerehrungs-Test) | 1. Klicke in der grünen Infobox auf **„Ergebnisse exportieren“**.<br>2. Öffne die heruntergeladene CSV-Datei in Excel. | Die Datei enthält oben die **Siegerliste / Platz 1** jeder Gruppe und darunter das vollständige, offizielle Kampfprotokoll mit allen Scores. | |
| **TC 8.3** | DSGVO: Teilnehmer anonymisieren | 1. Klicke auf den Button **„DSGVO: Teilnehmer anonymisieren“**.<br>2. Bestätige das Warn-Pop-up.<br>3. Prüfe die Teilnehmerliste. | Alle persönlichen Daten (Klarnamen, Vereine, Geburtsdaten) wurden unwiderruflich durch standardisierte Platzhalter (z. B. *„Kämpfer 1“*, *„Anonymisiert“*) ersetzt. Der Datenschutz ist perfekt gewahrt! | |
