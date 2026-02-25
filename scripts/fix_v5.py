#!/usr/bin/env python3
"""v5 quick wins: fix all remaining inline strings and add i18n keys."""

RESP = "src/services/core/botResponses.ts"
LOGIC = "src/services/core/botLogicService.ts"

# ============================================================================
# STEP 1: Add new i18n keys
# ============================================================================

with open(RESP, "r", encoding="utf-8") as f:
    resp = f.read()

NEW_KEYS_TYPE = """    | 'days_unit'
    | 'status_done'
    | 'status_ready'
    | 'status_searching'
    | 'status_header'
    | 'oem_direct_found'
    | 'oem_direct_scrape_error'
    | 'cancel_confirmed'"""

if "'days_unit'" not in resp:
    resp = resp.replace(
        "    | 'offer_confirmed'",
        NEW_KEYS_TYPE + "\n    | 'offer_confirmed'"
    )

NEW_TRANSLATIONS = """
    days_unit: {
        de: 'Tage',
        en: 'days',
        tr: 'g\u00fcn',
        ku: 'roj',
        pl: 'dni',
    },

    status_header: {
        de: 'Ich habe nachgesehen (Ticket {orderId}). Status: {status}. ',
        en: 'I\\'ve checked your order {orderId}. Current status: {status}. ',
        tr: 'Sipari\\u015finizi kontrol ettim ({orderId}). Durum: {status}. ',
        ku: 'Min fermana we kontrol kir ({orderId}). Rewi\\u015f: {status}. ',
        pl: 'Sprawdzi\\u0142em zam\\u00f3wienie {orderId}. Status: {status}. ',
    },

    status_done: {
        de: 'Ihre Bestellung ist abgeschlossen und sollte bald bei Ihnen sein!',
        en: 'It should be on its way or ready for pickup!',
        tr: 'Sipari\\u015finiz yola \\u00e7\\u0131km\\u0131\\u015f olmal\\u0131 veya teslim almaya haz\\u0131r!',
        ku: 'Div\\u00ea fermana we di r\\u00ea de be an amade be ji bo wergirtin\\u00ea!',
        pl: 'Powinno by\\u0107 w drodze lub gotowe do odbioru!',
    },

    status_ready: {
        de: 'Wir bearbeiten Ihre Bestellung. Gesch\\u00e4tzte Lieferzeit: {delivery} Tage.',
        en: 'It is currently being processed. Estimated delivery: {delivery} days.',
        tr: '\\u015eu anda i\\u015fleniyor. Tahmini teslimat: {delivery} g\\u00fcn.',
        ku: 'Niha t\\u00ea \\u015fuxulkirin. Gihandina texm\\u00een\\u00ee: {delivery} roj.',
        pl: 'Jest w trakcie realizacji. Szacowana dostawa: {delivery} dni.',
    },

    status_searching: {
        de: 'Wir suchen gerade noch nach dem besten Angebot f\\u00fcr Sie.',
        en: 'We are currently looking for the best price for you.',
        tr: 'Sizin i\\u00e7in en iyi fiyat\\u0131 ar\\u0131yoruz.',
        ku: 'Em niha ji bo we bihay\\u00ea her\\u00ee ba\\u015f dig\\u00earin.',
        pl: 'Szukamy dla Ciebie najlepszej oferty.',
    },

    oem_direct_found: {
        de: '\\u2705 OEM {oem} erkannt! Ich habe {count} Angebot(e) gefunden. Soll ich Ihnen die Details zeigen?',
        en: '\\u2705 OEM {oem} recognized! I found {count} offer(s). Want me to show you the details?',
        tr: '\\u2705 OEM {oem} tan\\u0131nd\\u0131! {count} teklif buldum. Detaylar\\u0131 g\\u00f6stermemi ister misiniz?',
        ku: '\\u2705 OEM {oem} hate nas\\u00een! Min {count} p\\u00ea\\u015fniyar d\\u00eet(in). Ma h\\u00fbn dixwazin h\\u00fbragahiyan bib\\u00een\\u0131m?',
        pl: '\\u2705 OEM {oem} rozpoznany! Znalaz\\u0142em {count} ofert(\\u0119). Pokaza\\u0107 szczeg\\u00f3\\u0142y?',
    },

    oem_direct_scrape_error: {
        de: '\\u2705 OEM {oem} erkannt. Ich leite Ihre Anfrage an einen Experten weiter, da die automatische Suche gerade nicht verf\\u00fcgbar ist.',
        en: '\\u2705 OEM {oem} recognized. I\\'m forwarding your request to an expert as the automated search is currently unavailable.',
        tr: '\\u2705 OEM {oem} tan\\u0131nd\\u0131. Otomatik arama \\u015fu anda kullan\\u0131lam\\u0131yor, iste\\u011finizi bir uzmana y\\u00f6nlendiriyorum.',
        ku: '\\u2705 OEM {oem} hate nas\\u00een. L\\u00eager\\u00eena otomat\\u00eek niha ne berdest e, ez dax\\u0131waziya we ji pispor\\u00ea re di\\u015f\\u00een\\u0131m.',
        pl: '\\u2705 OEM {oem} rozpoznany. Przekazuj\\u0119 zapytanie do eksperta, automatyczne wyszukiwanie jest niedost\\u0119pne.',
    },

    cancel_confirmed: {
        de: 'Kein Problem! Ihre Anfrage wurde abgebrochen. Wenn Sie etwas anderes brauchen, schreiben Sie mir einfach.',
        en: 'No problem! I\\'ve cancelled your request. If you need anything else, just write me.',
        tr: 'Sorun de\\u011fil! \\u0130ste\\u011finiz iptal edildi. Ba\\u015fka bir \\u015feye ihtiyac\\u0131n\\u0131z olursa, yaz\\u0131n.',
        ku: 'Tu pirsgir\\u00eek nîn e! Daxwaza we hate betal kirin. Heke h\\u00fbn ti\\u015ftek\\u00ee din hewce bikin, ji min re biniv\\u00eesin.',
        pl: '\\u017baden problem! Anulowa\\u0142em zapytanie. Je\\u015bli potrzebujesz czego\\u015b innego, napisz.',
    },
"""

if "days_unit:" not in resp:
    resp = resp.replace(
        "    typing_indicator: {",
        NEW_TRANSLATIONS + "\n    typing_indicator: {"
    )

with open(RESP, "w", encoding="utf-8") as f:
    f.write(resp)

print("Step 1: Added i18n keys to botResponses.ts")

# ============================================================================
# STEP 2: Fix inline strings
# ============================================================================

with open(LOGIC, "r", encoding="utf-8") as f:
    lines = f.readlines()

count = 0

# --- Fix 1: Remove duplicate if (L75-76) ---
for i in range(len(lines)):
    if i+1 < len(lines) and 'if (missingVehicleInfo.length > 0)' in lines[i] and 'if (missingVehicleInfo.length > 0)' in lines[i+1]:
        lines[i] = ""
        count += 1
        print(f"  OK [{count}]: removed duplicate if at L{i+1}")
        break

# --- Fix 2: answerGeneralQuestion prompt multilingual (L80-85) ---
for i in range(len(lines)):
    if 'language === "de"' in lines[i] and i+4 < len(lines) and 'Nutzerfrage' in lines[i+1]:
        # Replace DE/EN ternary with a universal prompt
        new_prompt = '''  const userPrompt = [
    `User message: "${userText}"`,
    `Known vehicle data: ${knownVehicleSummary}`,
    `Missing info: ${missingVehicleInfo.join(", ") || "none"}`,
    `IMPORTANT: Answer in ${language === 'de' ? 'German' : language === 'tr' ? 'Turkish' : language === 'ku' ? 'Kurdish (Kurmanji)' : language === 'pl' ? 'Polish' : 'English'}. Be helpful and concise.`
  ].join("\\n");
'''
        lines[i] = new_prompt
        lines[i+1] = ""
        lines[i+2] = ""
        lines[i+3] = ""
        lines[i+4] = ""
        count += 1
        print(f"  OK [{count}]: answerGeneralQuestion multilingual at L{i+1}")
        break

# --- Fix 3: Status reply i18n (L1803-1813) ---
for i in range(len(lines)):
    if 'if (language === "en")' in lines[i] and i+1 < len(lines) and 've checked your order' in lines[i+1]:
        new_block = '''      const statusReply = tWith('status_header', language, { orderId: order.id, status }) +
        (status === "done" ? t('status_done', language) :
         status === "ready" ? tWith('status_ready', language, { delivery }) :
         t('status_searching', language));
'''
        # Replace the entire if/else block (about 11 lines)
        lines[i] = new_block
        for j in range(1, 11):
            if i+j < len(lines):
                lines[i+j] = ""
        count += 1
        print(f"  OK [{count}]: status reply i18n at L{i+1}")
        break

# --- Fix 4: days_unit i18n (L2354) ---
for i in range(len(lines)):
    if "language === 'de' ? 'Tage'" in lines[i] and "'days'" in lines[i]:
        lines[i] = lines[i].replace(
            "language === 'de' ? 'Tage' : language === 'en' ? 'days' : language === 'tr' ? 'g\u00fcn' : language === 'pl' ? 'dni' : 'roj'",
            "t('days_unit', language)"
        )
        count += 1
        print(f"  OK [{count}]: days_unit at L{i+1}")
        break

# --- Fix 5: OEM-direct found string (L1379) ---
for i in range(len(lines)):
    if 'OEM ${extractedOem} erkannt! Ich habe' in lines[i]:
        lines[i] = "              reply: tWith('oem_direct_found', language, { oem: extractedOem, count: String(scrapeResult.length) }),\n"
        count += 1
        print(f"  OK [{count}]: oem_direct_found at L{i+1}")
        break

# --- Fix 6: OEM-direct scrape error string (L1391) ---
for i in range(len(lines)):
    if 'OEM ${extractedOem} erkannt. Ich leite' in lines[i]:
        lines[i] = "            reply: tWith('oem_direct_scrape_error', language, { oem: extractedOem }),\n"
        count += 1
        print(f"  OK [{count}]: oem_direct_scrape_error at L{i+1}")
        break

# --- Fix 7: Cancel/abort order string (L1409-1411) ---
for i in range(len(lines)):
    if 'lang === "en"' in lines[i] and 'cancelled your request' in lines[i+1] if i+1 < len(lines) else False:
        lines[i] = "        reply: t('cancel_confirmed', lang),\n"
        lines[i+1] = ""
        lines[i+2] = ""
        count += 1
        print(f"  OK [{count}]: cancel_confirmed at L{i+1}")
        break

# Write out, filter blanks
output = [l for l in lines if l != ""]
with open(LOGIC, "w", encoding="utf-8") as f:
    f.writelines(output)

remaining = sum(1 for l in output if 'language ===' in l)
print(f"\nTotal fixed: {count}")
print(f"Remaining language === checks: {remaining}")
