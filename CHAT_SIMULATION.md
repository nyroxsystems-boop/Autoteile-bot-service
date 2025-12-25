# 📱 KOMPLETTE CHAT-SIMULATION

## Szenario: Kunde sucht Bremsscheiben für VW Golf

---

### 💬 **Nachricht 1: Kunde startet Konversation**

**Kunde:**
```
Hallo, ich brauche Bremsscheiben für meinen Golf
```

**Bot:**
```
Hallo! 👋 Ich helfe dir gerne bei der Teilebeschaffung.

Für welches Fahrzeug benötigst du das Teil?

Bitte gib mir folgende Infos:
🚗 Marke & Modell (z.B. VW Golf 7)
📅 Baujahr
🔧 Motorisierung (falls bekannt)

Oder schicke mir ein Foto vom Fahrzeugschein!
```

---

### 💬 **Nachricht 2: Kunde gibt Fahrzeugdaten**

**Kunde:**
```
VW Golf 7, Baujahr 2015, 1.6 TDI
```

**Bot:**
```
✅ Perfekt! Ich habe dein Fahrzeug erfasst:

🚗 VW Golf 7
📅 2015
🔧 1.6 TDI

Jetzt suche ich die passende OEM-Nummer für deine Bremsscheiben...
```

---

### 💬 **Nachricht 3: Bot findet OEM-Nummer**

**Bot (nach 3-5 Sekunden):**
```
✅ OEM-Nummer gefunden: 1K0615301AA

Ich prüfe jetzt unseren Bestand und die besten Angebote...
```

---

### 💬 **Nachricht 4a: FALL 1 - Teil ist auf Lager**

**Bot (mit Produktbild):**
```
✅ *Perfektes Angebot gefunden!*

🏷️ *Marke:* OEM
💰 *Preis:* 25,99 EUR
📦 *Sofort abholbereit!*

⚠️ HINWEIS: Mit deiner Bestätigung gibst du ein 
verbindliches Kaufangebot bei deinem Händler ab.

Jetzt verbindlich bestellen?

[Ja, jetzt bestellen] [Nein, andere suchen]
```

---

### 💬 **Nachricht 4b: FALL 2 - Teil nicht auf Lager (externe Shops)**

**Bot (mit Produktbild von Autodoc):**
```
✅ *Perfektes Angebot gefunden!*

🏷️ *Marke:* RIDEX
💰 *Preis:* 28,49 EUR
🚚 *Lieferzeit:* 2 Tage

⚠️ HINWEIS: Mit deiner Bestätigung gibst du ein 
verbindliches Kaufangebot bei deinem Händler ab.

Jetzt verbindlich bestellen?

[Ja, jetzt bestellen] [Nein, andere suchen]
```

---

### 💬 **Nachricht 5a: Kunde bestätigt**

**Kunde:**
```
Ja, jetzt bestellen
```

**Bot:**
```
✅ *Bestellung aufgenommen!*

Deine Bestellung wurde an deinen Händler weitergeleitet.

📦 Bestellnummer: #ORD-2025-001234
🏷️ Artikel: Bremsscheiben (1K0615301AA)
💰 Preis: 25,99 EUR
📦 Abholung: Sofort möglich

Du erhältst eine Bestätigung sobald dein Händler 
die Bestellung bearbeitet hat.

Kann ich dir noch bei etwas helfen?
```

---

### 💬 **Nachricht 5b: Kunde will mehr Optionen**

**Kunde:**
```
Nein, andere suchen
```

**Bot:**
```
✅ *Ich habe mehrere Angebote gefunden!*

Bitte wähle eines:

*1.* 🏷️ OEM
   💰 25,99 EUR | 📦 Sofort

*2.* 🏷️ RIDEX
   💰 28,49 EUR | 🚚 2 Tage

*3.* 🏷️ STARK
   💰 28,49 EUR | 🚚 2 Tage

⚠️ Die Auswahl einer Option gilt als verbindliches Kaufangebot.

👉 Antworte mit *1*, *2* oder *3*.
```

---

### 💬 **Nachricht 6: Kunde wählt Option**

**Kunde:**
```
1
```

**Bot:**
```
✅ *Bestellung aufgenommen!*

Deine Bestellung wurde an deinen Händler weitergeleitet.

📦 Bestellnummer: #ORD-2025-001234
🏷️ Artikel: Bremsscheiben OEM (1K0615301AA)
💰 Preis: 25,99 EUR
📦 Abholung: Sofort möglich

Du erhältst eine Bestätigung sobald dein Händler 
die Bestellung bearbeitet hat.

Kann ich dir noch bei etwas helfen?
```

---

## 🎯 **Was der Händler im Dashboard sieht:**

### Order Details:
```
Bestellung #ORD-2025-001234
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Kunde: +49 170 1234567
Status: Bestätigt ✅
Erstellt: 25.12.2025, 20:45 Uhr

FAHRZEUG
🚗 VW Golf 7 (2015)
🔧 1.6 TDI

ARTIKEL
🏷️ Bremsscheiben
📋 OEM-Nr: 1K0615301AA
🏪 Quelle: Händler-Lager

ANGEBOT
💰 Preis: 25,99 EUR
📦 Verfügbarkeit: Sofort abholbereit
🚚 Lieferzeit: 0 Tage

ALTERNATIVE ANGEBOTE (nicht gewählt)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. RIDEX - 28,49 EUR - Autodoc
   🔗 https://www.autodoc.de/ridex/7998914
   📦 2 Tage Lieferzeit

2. STARK - 28,49 EUR - Autodoc
   🔗 https://www.autodoc.de/stark/7306554
   📦 2 Tage Lieferzeit

AKTIONEN
[Bestellung bestätigen] [Kunde kontaktieren] [Stornieren]
```

---

## 📊 **Zusammenfassung der Pipeline:**

1. ✅ **Fahrzeugdaten erfassen** (Marke, Modell, Jahr, Motor)
2. ✅ **OEM-Nummer ermitteln** (via TecDoc/AI)
3. ✅ **ZUERST Händler-Bestand prüfen** 
   - Wenn vorhanden → Sofort anbieten (günstiger + sofort abholbar)
4. ✅ **Falls nicht vorhanden → Externe Shops scrapen**
   - Autodoc, KFZTeile24, etc.
5. ✅ **Kunde bekommt:**
   - Schönes Angebot mit Bild
   - Preis, Marke, Lieferzeit
   - ❌ KEIN Shop-Name
   - ❌ KEIN Link
6. ✅ **Händler sieht im Dashboard:**
   - Alle Angebote MIT Links
   - Kann direkt bei Autodoc bestellen
   - Sieht alle Alternativen

---

## 🎯 **Vorteile für den Händler:**

1. **Eigener Bestand wird ZUERST verkauft** (höhere Marge!)
2. **Kunde sieht nicht die Quelle** (keine Preisvergleiche)
3. **Händler behält Kontrolle** (kann Marge aufschlagen)
4. **Automatische Beschaffung** (wenn nicht auf Lager)
5. **Professioneller Eindruck** (schnell + zuverlässig)
