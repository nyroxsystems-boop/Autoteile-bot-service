#!/usr/bin/env python3
"""v4 audit: Offer-card template builder + all remaining inline strings."""

RESP = "src/services/core/botResponses.ts"
LOGIC = "src/services/core/botLogicService.ts"
SQ = "\u2019"

# ============================================================================
# STEP 1: Add offer card label keys to botResponses.ts
# ============================================================================

with open(RESP, "r", encoding="utf-8") as f:
    resp = f.read()

NEW_KEYS_TYPE = """    | 'offer_brand_label'
    | 'offer_price_label'
    | 'offer_stock_label'
    | 'offer_instant'
    | 'na_text'
    | 'btn_yes_order'
    | 'btn_no_others'
    | 'qa_error'
    | 'qa_missing_info'"""

if "'offer_brand_label'" not in resp:
    resp = resp.replace(
        "    | 'offer_confirmed'",
        NEW_KEYS_TYPE + "\n    | 'offer_confirmed'"
    )

NEW_TRANSLATIONS = """
    offer_brand_label: {
        de: 'Marke',
        en: 'Brand',
        tr: 'Marka',
        ku: 'Marka',
        pl: 'Marka',
    },

    offer_price_label: {
        de: 'Preis',
        en: 'Price',
        tr: 'Fiyat',
        ku: 'Biha',
        pl: 'Cena',
    },

    offer_stock_label: {
        de: 'Verf\\u00fcgbarkeit',
        en: 'Stock',
        tr: 'Stok',
        ku: 'Amade',
        pl: 'Dost\\u0119pno\\u015b\\u0107',
    },

    offer_instant: {
        de: '\\ud83d\\udce6 Sofort',
        en: '\\ud83d\\udce6 Instant',
        tr: '\\ud83d\\udce6 Hemen',
        ku: '\\ud83d\\udce6 Tavil\\u00ea',
        pl: '\\ud83d\\udce6 Od r\\u0119ki',
    },

    na_text: {
        de: 'k.A.',
        en: 'n/a',
        tr: 'bilgi yok',
        ku: 'ne d\\u00eayar',
        pl: 'b.d.',
    },

    btn_yes_order: {
        de: 'Ja, jetzt bestellen',
        en: 'Yes, order now',
        tr: 'Evet, sipari\\u015f ver',
        ku: 'Er\\u00ea, niha ferman bide',
        pl: 'Tak, zam\\u00f3w teraz',
    },

    btn_no_others: {
        de: 'Nein, andere suchen',
        en: 'No, show others',
        tr: 'Hay\\u0131r, di\\u011ferlerini g\\u00f6ster',
        ku: 'Na, y\\u00ean din n\\u00ee\\u015fan bide',
        pl: 'Nie, poka\\u017c inne',
    },

    qa_error: {
        de: 'Gute Frage! Leider kann ich sie gerade nicht beantworten. Versuchen Sie es bitte sp\\u00e4ter erneut.',
        en: 'Good question! I can\\'t answer it right now, please try again later.',
        tr: '\\u0130yi soru! \\u015eu anda cevaplayam\\u0131yorum, l\\u00fctfen daha sonra tekrar deneyin.',
        ku: 'Pirsa ba\\u015f! Ez niha nikarim bersiv bidim, ji kerema xwe pa\\u015f\\u00ea d\\u00eesa bicerib\\u00eenin.',
        pl: 'Dobre pytanie! Niestety nie mog\\u0119 teraz odpowiedzie\\u0107, prosz\\u0119 spr\\u00f3bowa\\u0107 p\\u00f3\\u017aniej.',
    },

    qa_missing_info: {
        de: '\\n\\nDamit ich passende Teile finden kann, brauche ich noch: {fields}.',
        en: '\\n\\nTo find the correct parts, I still need: {fields}.',
        tr: '\\n\\nDo\\u011fru par\\u00e7alar\\u0131 bulmak i\\u00e7in hala ihtiyac\\u0131m var: {fields}.',
        ku: '\\n\\nJi bo d\\u00eetina per\\u00e7ey\\u00ean rast, h\\u00ea j\\u00ee hewce ye: {fields}.',
        pl: '\\n\\nAby znale\\u017a\\u0107 odpowiednie cz\\u0119\\u015bci, potrzebuj\\u0119 jeszcze: {fields}.',
    },
"""

if "offer_brand_label:" not in resp:
    resp = resp.replace(
        "    typing_indicator: {",
        NEW_TRANSLATIONS + "\n    typing_indicator: {"
    )

with open(RESP, "w", encoding="utf-8") as f:
    f.write(resp)

print("Step 1: Added offer card label keys to botResponses.ts")

# ============================================================================
# STEP 2: Fix all remaining inline strings in botLogicService.ts
# ============================================================================

with open(LOGIC, "r", encoding="utf-8") as f:
    lines = f.readlines()

count = 0

def fix_line(idx, old_check, new_content, label):
    """Replace a line by index if it matches the check."""
    global count
    if idx < len(lines) and old_check(lines[idx]):
        lines[idx] = new_content + "\n"
        count += 1
        print(f"  OK [{count}]: {label} at L{idx+1}")
        return True
    return False

def fix_lines(idx, num_lines, old_check, new_content, label):
    """Replace multiple lines by index if first matches."""
    global count
    if idx < len(lines) and old_check(lines[idx]):
        lines[idx] = new_content + "\n"
        for j in range(1, num_lines):
            if idx + j < len(lines):
                lines[idx + j] = ""
        count += 1
        print(f"  OK [{count}]: {label} at L{idx+1}")
        return True
    return False

# --- L353: Cosmetic log ---
for i, line in enumerate(lines):
    if "What we're sending to OpenAI" in line or "What we\u2019re sending to OpenAI" in line:
        lines[i] = line.replace("OpenAI", "Gemini").replace("What we're sending to", "Calling").replace("What we\u2019re sending to", "Calling")
        count += 1
        print(f"  OK [{count}]: cosmetic log at L{i+1}")
        break

# --- L1588: Abuse fallback ---
for i, line in enumerate(lines):
    if 'orch.reply || (order.language === "de"' in line and 'Beleidigungen' in line:
        lines[i] = "            const reply = orch.reply || t('abuse_warning', order.language ?? 'de');\n"
        count += 1
        print(f"  OK [{count}]: abuse_warning fallback at L{i+1}")
        break

# --- answerGeneralQuestion L76-82: missingInfoSentence ---
for i, line in enumerate(lines):
    if 'if (language === "de")' in line and i+5 < len(lines) and 'missingInfoSentence' in lines[i+1]:
        lines[i] = "    if (missingVehicleInfo.length > 0) {\n"
        lines[i+1] = "      missingInfoSentence = tWith('qa_missing_info', language, { fields: missingVehicleInfo.join(', ') });\n"
        lines[i+2] = ""
        lines[i+3] = ""
        lines[i+4] = ""
        lines[i+5] = ""
        count += 1
        print(f"  OK [{count}]: qa_missing_info at L{i+1}")
        break

# --- answerGeneralQuestion L103-105: qa_error ---
for i, line in enumerate(lines):
    if 'language === "de"' in line and 'Gute Frage' in lines[i+1] if i+1 < len(lines) else False:
        lines[i] = "    return t('qa_error', language);\n"
        lines[i+1] = ""
        lines[i+2] = ""
        count += 1
        print(f"  OK [{count}]: qa_error at L{i+1}")
        break

# --- L2322: delivery n/a ---
for i, line in enumerate(lines):
    if '(language === "en" ? "n/a" : "k.A.")' in line:
        lines[i] = line.replace(
            '(language === "en" ? "n/a" : "k.A.")',
            "t('na_text', language)"
        )
        count += 1
        print(f"  OK [{count}]: na_text at L{i+1}")

# --- L2363: Buttons ---
for i, line in enumerate(lines):
    if 'buttons: language === "en"' in line and 'order now' in line:
        lines[i] = "                buttons: [t('btn_yes_order', language), t('btn_no_others', language)]\n"
        count += 1
        print(f"  OK [{count}]: buttons at L{i+1}")
        break

# --- L2332-2347: Single offer card template ---
for i, line in enumerate(lines):
    if 'language === "en"' in line and i+1 < len(lines) and 'Perfect Match Found' in lines[i+1]:
        # Replace the entire single offer card (16 lines)
        new_block = """              replyText =
                `${t('offer_single_header', language)}\\n\\n` +
                `\\ud83c\\udff7\\ufe0f *${t('offer_brand_label', language)}:* ${offer.brand ?? t('na_text', language)}\\n` +
                `\\ud83d\\udcb0 *${t('offer_price_label', language)}:* ${endPrice} ${offer.currency}\\n` +
                `${stockInfo}\\n` +
                `${offer.availability && !isInStock ? `\\ud83d\\udce6 *${t('offer_stock_label', language)}:* ${offer.availability}\\n` : ''}` +
                `${bindingNote}\\n\\n` +
                `${t('offer_order_prompt', language)}`;"""
        lines[i] = new_block + "\n"
        # Clear old lines
        for j in range(1, 16):
            if i+j < len(lines):
                lines[i+j] = ""
        count += 1
        print(f"  OK [{count}]: single offer card at L{i+1}")
        break

# --- L2368-2385: Multi offer lines ---
for i, line in enumerate(lines):
    if 'language === "en"' in line and i+1 < len(lines) and 'top.map' in lines[i+1]:
        new_block = """              top.map(
                  (o: any, idx: number) => {
                    const isInStock = o.shopName === "H\\u00e4ndler-Lager" || o.shopName === "Eigener Bestand";
                    const deliveryInfo = isInStock ? t('offer_instant', language) : `\\ud83d\\ude9a ${o.deliveryTimeDays ?? t('na_text', language)} ${language === 'de' ? 'Tage' : language === 'en' ? 'days' : language === 'tr' ? 'g\\u00fcn' : language === 'pl' ? 'dni' : 'roj'}`;
                    return `*${idx + 1}.* \\ud83c\\udff7\\ufe0f ${o.brand ?? t('na_text', language)}\\n` +
                      \`   \\ud83d\\udcb0 ${calculateEndPrice(o.price)} ${o.currency} | ${deliveryInfo}\`;
                  }
                );"""
        lines[i] = "            const lines =\n" + new_block + "\n"
        # Clear old lines (about 18 lines)
        for j in range(1, 18):
            if i+j < len(lines):
                lines[i+j] = ""
        count += 1
        print(f"  OK [{count}]: multi offer lines at L{i+1}")
        break

# --- L2389-2398: Multi offer header+prompt ---  
for i, line in enumerate(lines):
    if 'language === "en"' in line and i+1 < len(lines) and 'I found multiple offers' in lines[i+1]:
        new_block = """              t('offer_multi_header', language) + "\\n\\n" +
                lines.join("\\n\\n") +
                multiBindingNote +
                "\\n\\n" + t('offer_choose_prompt', language);"""
        lines[i] = "            replyText =\n" + new_block + "\n"
        # Clear old lines
        for j in range(1, 9):
            if i+j < len(lines):
                lines[i+j] = ""
        count += 1
        print(f"  OK [{count}]: multi offer header at L{i+1}")
        break

# --- L797: cautious de check (cautious && language === "de") ---
for i, line in enumerate(lines):
    if 'cautious && language === "de"' in line and 'bitte kurz' in lines[i+1] if i+1 < len(lines) else False:
        # This is the caution note — already partially fixed, this is the DE branch
        # The full pattern is: cautious && language === "de" ? " (bitte kurz prüfen)" : cautious ? t(...)
        # Actually let me check what's there now
        print(f"  INFO: Caution at L{i+1}: {repr(lines[i][:80])}")
        break

# Write output (filter blank lines)
output = [l for l in lines if l != ""]
with open(LOGIC, "w", encoding="utf-8") as f:
    f.writelines(output)

after_count = sum(1 for l in output if 'language === "en"' in l or 'language === "de"' in l)
print(f"\nTotal fixed: {count}")
print(f"Remaining language checks: {after_count}")
