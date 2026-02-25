#!/usr/bin/env python3
"""Bulk i18n replacement: add translations + replace inline strings."""
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESP = os.path.join(BASE, "src/services/core/botResponses.ts")
LOGIC = os.path.join(BASE, "src/services/core/botLogicService.ts")

# ============================================================================
# STEP 1: Add translations to botResponses.ts
# ============================================================================

with open(RESP, "r") as f:
    resp = f.read()

NEW_TRANSLATIONS = """
    caution_check: {
        de: ' (bitte kurz pr\\u00fcfen)',
        en: ' (please double-check)',
        tr: ' (l\\u00fctfen kontrol edin)',
        ku: ' (ji kerema xwe kontrol bikin)',
        pl: ' (prosz\\u0119 sprawdzi\\u0107)',
    },

    part_mentioned: {
        de: 'das genannte Teil',
        en: 'the part you mentioned',
        tr: 'bahsetti\\u011finiz par\\u00e7a',
        ku: 'per\\u00e7eya ku we got',
        pl: 'wspomniana cz\\u0119\\u015b\\u0107',
    },

    vehicle_correction: {
        de: 'Oh, das tut mir leid. Bitte schicken Sie mir ein Foto vom Fahrzeugschein oder die korrekte VIN, damit ich das richtige Fahrzeug finden kann.',
        en: 'Oh, I\\'m sorry. Please send me a photo of your registration or the correct VIN so I can identify the right car.',
        tr: '\\u00d6z\\u00fcr dilerim. L\\u00fctfen ruhsat foto\\u011fraf\\u0131 veya do\\u011fru VIN g\\u00f6nderin.',
        ku: 'Bibore. Ji kerema xwe w\\u00eaneya belgey\\u00ea an VIN-a rast bi\\u015f\\u00eenin.',
        pl: 'Przepraszam. Prosz\\u0119 wys\\u0142a\\u0107 zdj\\u0119cie dowodu rejestracyjnego lub poprawny VIN.',
    },

    confirm_vehicle_yes: {
        de: 'Welches Teil suchen Sie? Bitte nennen Sie die Position und eventuelle Symptome.',
        en: 'Which part do you need? Please include position and symptoms.',
        tr: 'Hangi par\\u00e7aya ihtiyac\\u0131n\\u0131z var? L\\u00fctfen pozisyon ve belirtileri de belirtin.',
        ku: 'H\\u00fbn k\\u00eejan per\\u00e7ey\\u00ea hewce ne? Ji kerema xwe cih \\u00fb n\\u00ee\\u015faneyan j\\u00ee biniv\\u00eesin.',
        pl: 'Jakiej cz\\u0119\\u015bci potrzebujesz? Prosz\\u0119 poda\\u0107 pozycj\\u0119 i objawy.',
    },

    offer_collecting: {
        de: 'Ich suche noch passende Angebote. Sie bekommen gleich eine Auswahl.',
        en: 'I\\'m still collecting offers for you. You\\'ll get a selection shortly.',
        tr: 'Sizin i\\u00e7in h\\u00e2l\\u00e2 teklifler topluyorum. K\\u0131sa s\\u00fcrede bir se\\u00e7enek alacaks\\u0131n\\u0131z.',
        ku: 'Ez h\\u00ea j\\u00ee ji bo we p\\u00ea\\u015fniyaran kom dikim.',
        pl: 'Wci\\u0105\\u017c zbieram dla Ciebie oferty. Wkr\\u00f3tce otrzymasz wyb\\u00f3r.',
    },

    offer_binding_note: {
        de: '\\n\\n\\u26a0\\ufe0f HINWEIS: Mit Ihrer Best\\u00e4tigung geben Sie ein verbindliches Kaufangebot bei Ihrem H\\u00e4ndler ab.',
        en: '\\n\\n\\u26a0\\ufe0f NOTE: This offer is a binding purchase agreement.',
        tr: '\\n\\n\\u26a0\\ufe0f NOT: Bu teklif ba\\u011flay\\u0131c\\u0131 bir sat\\u0131n alma s\\u00f6zle\\u015fmesidir.',
        ku: '\\n\\n\\u26a0\\ufe0f ZAN\\u00ceN: Ev p\\u00ea\\u015fniyar peymana kir\\u00een\\u00ea ya gir\\u00eaday\\u00ee ye.',
        pl: '\\n\\n\\u26a0\\ufe0f UWAGA: Ta oferta stanowi wi\\u0105\\u017c\\u0105c\\u0105 umow\\u0119 kupna.',
    },

    offer_multi_binding: {
        de: '\\n\\n\\u26a0\\ufe0f Die Auswahl einer Option gilt als verbindliches Kaufangebot.',
        en: '\\n\\n\\u26a0\\ufe0f Selecting an option constitutes a binding purchase agreement.',
        tr: '\\n\\n\\u26a0\\ufe0f Bir se\\u00e7enek belirlemek ba\\u011flayic\\u0131 bir sat\\u0131n alma s\\u00f6zle\\u015fmesi olu\\u015fturur.',
        ku: '\\n\\n\\u26a0\\ufe0f Hilbijartina vebijark\\u00eakê peymana kir\\u00een\\u00ea ya gir\\u00eaday\\u00ee \\u00e7\\u00ea dike.',
        pl: '\\n\\n\\u26a0\\ufe0f Wyb\\u00f3r opcji stanowi wi\\u0105\\u017c\\u0105c\\u0105 umow\\u0119 kupna.',
    },

    offer_pickup: {
        de: '\\ud83d\\udce6 *Sofort abholbereit!*',
        en: '\\ud83d\\udce6 *Available for immediate pickup!*',
        tr: '\\ud83d\\udce6 *Hemen teslim al\\u0131nabilir!*',
        ku: '\\ud83d\\udce6 *Tavil\\u00ea amade ye ji bo wergirtin\\u00ea!*',
        pl: '\\ud83d\\udce6 *Dost\\u0119pne do natychmiastowego odbioru!*',
    },

    offer_delivery: {
        de: '\\ud83d\\ude9a *Lieferzeit:* {delivery} Tage',
        en: '\\ud83d\\ude9a *Delivery:* {delivery} days',
        tr: '\\ud83d\\ude9a *Teslimat:* {delivery} g\\u00fcn',
        ku: '\\ud83d\\ude9a *Gihandina:* {delivery} roj',
        pl: '\\ud83d\\ude9a *Dostawa:* {delivery} dni',
    },

    offer_single_header: {
        de: '\\u2705 *Perfektes Angebot gefunden!*',
        en: '\\u2705 *Perfect Match Found!*',
        tr: '\\u2705 *M\\u00fckemmel E\\u015fle\\u015fme Bulundu!*',
        ku: '\\u2705 *Lihevhatina B\\u00eak\\u00eamas\\u00ee Hat D\\u00eetin!*',
        pl: '\\u2705 *Znaleziono idealne dopasowanie!*',
    },

    offer_multi_header: {
        de: '\\u2705 *Ich habe mehrere Angebote gefunden!*\\n\\nBitte w\\u00e4hlen Sie eines:',
        en: '\\u2705 *I found multiple offers!*\\n\\nPlease choose one:',
        tr: '\\u2705 *Birden fazla teklif buldum!*\\n\\nL\\u00fctfen birini se\\u00e7in:',
        ku: '\\u2705 *Min gelek p\\u00ea\\u015fniyar d\\u00eetin!*\\n\\nJi kerema xwe yek\\u00ea hilbij\\u00earin:',
        pl: '\\u2705 *Znalaz\\u0142em kilka ofert!*\\n\\nProszę wybra\\u0107 jedn\\u0105:',
    },

    offer_choose_prompt: {
        de: '\\ud83d\\udc49 Antworten Sie mit *1*, *2* oder *3*.',
        en: '\\ud83d\\udc49 Reply with *1*, *2* or *3*.',
        tr: '\\ud83d\\udc49 *1*, *2* veya *3* ile yan\\u0131tlay\\u0131n.',
        ku: '\\ud83d\\udc49 Bi *1*, *2* an *3* bersiv bidin.',
        pl: '\\ud83d\\udc49 Odpowiedz *1*, *2* lub *3*.',
    },

    offer_order_prompt: {
        de: 'Jetzt verbindlich bestellen?',
        en: 'Do you want to order this now?',
        tr: '\\u015eimdi sipari\\u015f vermek ister misiniz?',
        ku: 'Ma h\\u00fbn dixwazin niha ferman\\u00ea bidin?',
        pl: 'Czy chcesz teraz zam\\u00f3wi\\u0107?',
    },

    offer_choice_invalid: {
        de: 'Bitte antworten Sie mit 1, 2 oder 3, um ein Angebot auszuw\\u00e4hlen.',
        en: 'Please reply with 1, 2 or 3 to pick one of the offers.',
        tr: 'L\\u00fctfen tekliflerden birini se\\u00e7mek i\\u00e7in 1, 2 veya 3 ile yan\\u0131tlay\\u0131n.',
        ku: 'Ji kerema xwe bi 1, 2 an 3 bersiv bidin.',
        pl: 'Prosz\\u0119 odpowiedzie\\u0107 1, 2 lub 3.',
    },

    offer_choice_not_found: {
        de: 'Ich konnte Ihre Auswahl nicht zuordnen. Ich zeige Ihnen die Angebote erneut.',
        en: 'I couldn\\'t match your choice. I\\'ll show the offers again.',
        tr: 'Se\\u00e7iminizi e\\u015fle\\u015ftiremedim. Teklifleri tekrar g\\u00f6sterece\\u011fim.',
        ku: 'Min nekar\\u00ee vebijarka we lihev bikim. Ez \\u00ea p\\u00ea\\u015fniyaran d\\u00eesa n\\u00ee\\u015fan bidim.',
        pl: 'Nie uda\\u0142o si\\u0119 dopasowa\\u0107 wyboru. Poka\\u017c\\u0119 oferty ponownie.',
    },

    offer_confirmed_choice: {
        de: 'Vielen Dank! Ihre Bestellung ({orderId}) wurde gespeichert. Dies ist nun eine verbindliche Bestellung. Ihr H\\u00e4ndler wird Sie bald kontaktieren.',
        en: 'Thank you! Your order ({orderId}) has been saved. This is now a binding agreement. Your dealer will contact you soon.',
        tr: 'Te\\u015fekk\\u00fcrler! Sipari\\u015finiz ({orderId}) kaydedildi. Bu art\\u0131k ba\\u011flayc\\u0131 bir anla\\u015fmad\\u0131r.',
        ku: 'Spas! Fermana we ({orderId}) hat tomarkirin. Ev niha peymana gir\\u00eaday\\u00ee ye.',
        pl: 'Dzi\\u0119kuj\\u0119! Zam\\u00f3wienie ({orderId}) zosta\\u0142o zapisane. To jest teraz wi\\u0105\\u017c\\u0105ca umowa.',
    },

    offer_confirm_prompt: {
        de: 'Wenn das Angebot f\\u00fcr Sie passt, antworten Sie bitte mit "Ja" oder "OK". Wenn nicht, sagen Sie mir kurz, was Ihnen wichtig ist.',
        en: 'If this offer works for you, please reply with "Yes" or "OK". If not, tell me what matters most (price, brand, delivery time).',
        tr: 'Bu teklif sizin i\\u00e7in uygunsa, l\\u00fctfen "Evet" veya "OK" ile yan\\u0131tlay\\u0131n.',
        ku: 'Heke ev p\\u00ea\\u015fniyar ji bo we maq\\u00fbl e, ji kerema xwe bi "Er\\u00ea" an "OK" bersiv bidin.',
        pl: 'Je\\u015bli ta oferta Ci odpowiada, odpowiedz "Tak" lub "OK".',
    },

    offer_decline_alt: {
        de: 'Alles klar, ich schaue, ob ich Ihnen noch andere Angebote finden kann.',
        en: 'Got it, I\\'ll see if I can find alternative offers. Tell me what matters most: price, brand or delivery time.',
        tr: 'Anlad\\u0131m, alternatif teklifler bulabilir miyim bakaca\\u011f\\u0131m.',
        ku: 'Ba\\u015f e, ez \\u00ea bib\\u00een\\u0131m ka ez dikarim p\\u00ea\\u015fniyar\\u00ean din bib\\u00een\\u0131m.',
        pl: 'Rozumiem, zobacz\\u0119 czy znajd\\u0119 alternatywne oferty.',
    },

    offer_lost: {
        de: 'Ich habe das Angebot nicht mehr parat. Ich hole die Optionen nochmal.',
        en: 'I lost track of the offer. I\\'ll fetch the options again.',
        tr: 'Teklifi kaybettim. Se\\u00e7enekleri tekrar getirece\\u011fim.',
        ku: 'Min p\\u00ea\\u015fniyar winda kir. Ez \\u00ea vebijark\\u00ean d\\u00eesa b\\u00een\\u0131m.',
        pl: 'Straci\\u0142em \\u015blad oferty. Pobieram opcje ponownie.',
    },

    offer_not_found: {
        de: 'Ich konnte dieses Angebot nicht mehr finden. Ich zeige Ihnen die verf\\u00fcgbaren Angebote erneut.',
        en: 'I couldn\\'t find that offer anymore. I\\'ll show available offers again.',
        tr: 'Bu teklifi art\\u0131k bulamad\\u0131m. Mevcut teklifleri tekrar g\\u00f6sterece\\u011fim.',
        ku: 'Min \\u00ead\\u00ee nekar\\u00ee v\\u00ea p\\u00ea\\u015fniyar\\u00ea bib\\u00een\\u0131m.',
        pl: 'Nie mog\\u0119 ju\\u017c znale\\u017a\\u0107 tej oferty. Poka\\u017c\\u0119 dost\\u0119pne oferty ponownie.',
    },

    offer_fetch_failed: {
        de: 'Ich konnte gerade keine Angebote abrufen. Ich melde mich bald erneut.',
        en: 'I couldn\\'t retrieve offers right now. I\\'ll update you soon.',
        tr: '\\u015eu anda teklifleri alamad\\u0131m. Yak\\u0131nda size bilgi verece\\u011fim.',
        ku: 'Min niha nekar\\u00ee p\\u00ea\\u015fniyaran bist\\u00een\\u0131m.',
        pl: 'Nie uda\\u0142o si\\u0119 pobra\\u0107 ofert. Wkr\\u00f3tce si\\u0119 odezw\\u0119.',
    },

    offer_confirmed: {
        de: 'Perfekt, ich habe dieses Angebot f\\u00fcr Sie gespeichert. Ihre Bestellung ({orderId}) ist nun verbindlich. Ihr H\\u00e4ndler wird Sie bald kontaktieren.',
        en: 'Perfect, I\\'ve saved this offer for you. Your order ({orderId}) is now binding. Your dealer will contact you soon.',
        tr: 'M\\u00fckemmel, bu teklifi sizin i\\u00e7in kaydettim. Sipari\\u015finiz ({orderId}) art\\u0131k ba\\u011flayc\\u0131d\\u0131r.',
        ku: 'B\\u00eak\\u00eamas\\u00ee, min ev p\\u00ea\\u015fniyar ji bo we tomar kir. Fermana we ({orderId}) niha gir\\u00eaday\\u00ee ye.',
        pl: 'Doskonale, zapisa\\u0142em t\\u0119 ofert\\u0119. Zam\\u00f3wienie ({orderId}) jest teraz wi\\u0105\\u017c\\u0105ce.',
    },

    delivery_or_pickup: {
        de: 'M\\u00f6chten Sie das Teil nach Hause geliefert bekommen (D) oder holen Sie es beim H\\u00e4ndler ab (P)?',
        en: 'Do you want the part delivered to your home (D) or do you want to pick it up at the dealer (P)?',
        tr: 'Par\\u00e7an\\u0131n eve teslim edilmesini mi (D) yoksa bayiden teslim almay\\u0131 m\\u0131 (P) tercih edersiniz?',
        ku: 'Ma h\\u00fbn dixwazin per\\u00e7e were mal\\u00ea we (D) an h\\u00fbn dixwazin ji firo\\u015fkar bist\\u00een\\u0131n (P)?',
        pl: 'Czy chcesz dostaw\\u0119 do domu (D) czy odbi\\u00f3r u dealera (P)?',
    },

    delivery_ask_address: {
        de: 'Sehr gute Wahl. Bitte senden Sie mir nun Ihre vollst\\u00e4ndige Lieferadresse.',
        en: 'Excellent choice. Please send me your full delivery address.',
        tr: 'M\\u00fckemmel se\\u00e7im. L\\u00fctfen tam teslimat adresinizi g\\u00f6nderin.',
        ku: 'Vebijarkek h\\u00eaja. Ji kerema xwe navni\\u015fana gihandina xwe ya tevahi bi\\u015f\\u00eenin.',
        pl: '\\u015awietny wyb\\u00f3r. Prosz\\u0119 poda\\u0107 pe\\u0142ny adres dostawy.',
    },

    pickup_location: {
        de: 'Perfekt! Sie k\\u00f6nnen das Teil hier abholen: {location}. Bis bald!',
        en: 'Perfect! You can pick up the part at: {location}. See you soon!',
        tr: 'M\\u00fckemmel! Par\\u00e7ay\\u0131 buradan teslim alabilirsiniz: {location}.',
        ku: 'B\\u00eak\\u00eamas\\u00ee! H\\u00fbn dikarin per\\u00e7ey\\u00ea li vir bist\\u00een\\u0131n: {location}.',
        pl: 'Doskonale! Mo\\u017cesz odebra\\u0107 cz\\u0119\\u015b\\u0107 pod adresem: {location}.',
    },

    address_saved: {
        de: 'Vielen Dank! Ihre Lieferadresse wurde gespeichert. Wir versenden das Teil in K\\u00fcrze.',
        en: 'Thank you! Your delivery address has been saved. We will ship the part shortly.',
        tr: 'Te\\u015fekk\\u00fcrler! Teslimat adresiniz kaydedildi.',
        ku: 'Spas! Navni\\u015fana gihandina we hat tomarkirin.',
        pl: 'Dzi\\u0119kuj\\u0119! Adres dostawy zosta\\u0142 zapisany.',
    },

    address_invalid: {
        de: 'Bitte geben Sie eine g\\u00fcltige Lieferadresse an.',
        en: 'Please provide a valid delivery address.',
        tr: 'L\\u00fctfen ge\\u00e7erli bir teslimat adresi girin.',
        ku: 'Ji kerema xwe navni\\u015fanek gihandina derbasdar biniv\\u00eesin.',
        pl: 'Prosz\\u0119 poda\\u0107 prawid\\u0142owy adres dostawy.',
    },

    fresh_start: {
        de: 'Klar! Schicken Sie mir ein Foto vom Fahrzeugschein des neuen Fahrzeugs.',
        en: 'Sure! Send me a photo of the vehicle registration document for the new car.',
        tr: 'Tabii! Yeni ara\\u00e7 i\\u00e7in ruhsat foto\\u011fraf\\u0131n\\u0131 g\\u00f6nderin.',
        ku: 'B\\u00ea guman! W\\u00eaneya belgeya qeydkirina wesay\\u00eeta n\\u00fb bi\\u015f\\u00eenin.',
        pl: 'Jasne! Wy\\u015blij mi zdj\\u0119cie dowodu rejestracyjnego nowego pojazdu.',
    },

    follow_up_part: {
        de: 'Ich nutze Ihr {make} {model}. Welches Teil ben\\u00f6tigen Sie?',
        en: 'I\\'m using your {make} {model}. What part do you need?',
        tr: '{make} {model} arac\\u0131n\\u0131z\\u0131 kullan\\u0131yorum. Hangi par\\u00e7aya ihtiyac\\u0131n\\u0131z var?',
        ku: 'Ez {make} {model} we bi kar t\\u00een\\u0131m. H\\u00fbn k\\u00eejan per\\u00e7ey\\u00ea hewce ne?',
        pl: 'U\\u017cywam Twojego {make} {model}. Jakiej cz\\u0119\\u015bci potrzebujesz?',
    },

    follow_up_fallback: {
        de: 'Welches Teil ben\\u00f6tigen Sie f\\u00fcr Ihr Fahrzeug?',
        en: 'What part do you need for your vehicle?',
        tr: 'Arac\\u0131n\\u0131z i\\u00e7in hangi par\\u00e7aya ihtiyac\\u0131n\\u0131z var?',
        ku: 'H\\u00fbn ji bo wesay\\u00eeta xwe k\\u00eejan per\\u00e7ey\\u00ea hewce ne?',
        pl: 'Jakiej cz\\u0119\\u015bci potrzebujesz do swojego pojazdu?',
    },

    goodbye: {
        de: 'Vielen Dank! Wenn Sie noch etwas brauchen, schreiben Sie mir jederzeit. \\ud83d\\udc4b',
        en: 'Thank you! If you need anything else, just write me anytime. \\ud83d\\udc4b',
        tr: 'Te\\u015fekk\\u00fcrler! Ba\\u015fka bir \\u015feye ihtiyac\\u0131n\\u0131z olursa, istedi\\u011finiz zaman yaz\\u0131n. \\ud83d\\udc4b',
        ku: 'Spas! Heke h\\u00fbn ti\\u015ftek\\u00ee din hewce bikin, her dem ji min re biniv\\u00eesin. \\ud83d\\udc4b',
        pl: 'Dzi\\u0119kuj\\u0119! Je\\u015bli potrzebujesz czego\\u015b jeszcze, napisz w dowolnym momencie. \\ud83d\\udc4b',
    },

    order_complete: {
        de: 'Ihre Bestellung ist abgeschlossen. Wenn Sie weitere Fragen haben, fragen Sie einfach!',
        en: 'Your order is complete. If you have further questions, just ask!',
        tr: 'Sipari\\u015finiz tamamland\\u0131. Ba\\u015fka sorular\\u0131n\\u0131z varsa, sormaktan \\u00e7ekinmeyin!',
        ku: 'Fermana we temam b\\u00fb. Heke pirs\\u00ean we y\\u00ean din hene, ten\\u00ea bipirsin!',
        pl: 'Zam\\u00f3wienie zosta\\u0142o zrealizowane. Je\\u015bli masz dodatkowe pytania, po prostu zapytaj!',
    },

    delivery_or_pickup_ask: {
        de: 'Bitte entscheiden Sie sich: Lieferung (D) oder Abholung (P)?',
        en: 'Please decide: Delivery (D) or Pickup (P)?',
        tr: 'L\\u00fctfen karar verin: Teslimat (D) veya Teslim Alma (P)?',
        ku: 'Ji kerema xwe biryar bidin: Gihandin (D) an Wergirtin (P)?',
        pl: 'Prosz\\u0119 zdecydowa\\u0107: Dostawa (D) czy Odbi\\u00f3r (P)?',
    },
"""

if "caution_check:" not in resp:
    marker = "    typing_indicator: {"
    resp = resp.replace(marker, NEW_TRANSLATIONS + "\n    typing_indicator: {")
    with open(RESP, "w") as f:
        f.write(resp)
    print("Step 1: Translations added to botResponses.ts")
else:
    print("Step 1: Translations already present, skipping")

# ============================================================================
# STEP 2: Replace inline strings in botLogicService.ts
# ============================================================================

with open(LOGIC, "r") as f:
    content = f.read()

count = 0
total = 0

def do_replace(old, new, label=""):
    global content, count, total
    total += 1
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"  OK [{count}]: {label}")
    else:
        print(f"  MISS: {label}")

# --- Simple replacements ---

do_replace(
    '(language === "en" ? "the part you mentioned" : "das genannte Teil")',
    "t('part_mentioned', language)",
    "part_mentioned"
)

do_replace(
    'cautious && language === "en"\n            ? " (please double-check)"\n            : ""',
    'cautious ? t(\'caution_check\', language) : ""',
    "caution_check"
)

# OCR success duplicates
do_replace(
    'language === "en"\n                      ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."\n                      : t(\'ocr_success\', language)',
    "t('ocr_success', language)",
    "ocr_success duplicate 1"
)

do_replace(
    'language === "en"\n                  ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."\n                  : t(\'ocr_success\', language)',
    "t('ocr_success', language)",
    "ocr_success duplicate 2"
)

# Ask vin general duplicate
do_replace(
    '(language === "en"\n                ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."\n                : t(\'collect_vehicle_manual\', language))',
    "t('ask_vin_general', language)",
    "ask_vin_general duplicate"
)

# Confirm vehicle yes
do_replace(
    'replyText = language === "en"\n              ? "Great! Which part do you need? Please include position and symptoms."\n              : t(\'collect_part\', language);',
    "replyText = t('confirm_vehicle_yes', language);",
    "confirm_vehicle_yes"
)

# Offer collecting
do_replace(
    """language === "en"
                ? "I'm still collecting offers for you. You'll get a selection shortly."
                : "Ich suche noch passende Angebote. Du bekommst gleich eine Auswahl.\"""",
    "t('offer_collecting', language)",
    "offer_collecting"
)

# Offer fetch failed
do_replace(
    """language === "en"
                ? "I couldn't retrieve offers right now. I'll update you soon."
                : "Ich konnte gerade keine Angebote abrufen. Ich melde mich bald erneut.\"""",
    "t('offer_fetch_failed', language)",
    "offer_fetch_failed"
)

# Offer choice invalid
do_replace(
    """language === "en"
                ? 'Please reply with 1, 2 or 3 to pick one of the offers.'
                : 'Bitte antworte mit 1, 2 oder 3, um ein Angebot auszuw\u00e4hlen.'""",
    "t('offer_choice_invalid', language)",
    "offer_choice_invalid"
)

# Delivery or pickup ask
do_replace(
    'replyText = language === "en"\n              ? "Please decide: Delivery (D) or Pickup (P)?"\n              : "Bitte entscheide dich: Lieferung (D) oder Abholung (P)?";',
    "replyText = t('delivery_or_pickup_ask', language);",
    "delivery_or_pickup_ask"
)

# Address saved
do_replace(
    'replyText = language === "en"\n              ? "Thank you! Your delivery address has been saved. We will ship the part shortly."\n              : "Vielen Dank! Deine Lieferadresse wurde gespeichert. Wir versenden das Teil in K\u00fcrze.";',
    "replyText = t('address_saved', language);",
    "address_saved"
)

# Address invalid
do_replace(
    'replyText = language === "en"\n              ? "Please provide a valid delivery address."\n              : "Bitte gib eine g\u00fcltige Lieferadresse an.";',
    "replyText = t('address_invalid', language);",
    "address_invalid"
)

# Fresh start
do_replace(
    'replyText = language === "en"\n              ? "Sure! Send me a photo of the vehicle registration document for the new car."\n              : "Klar! Schicken Sie mir ein Foto vom Fahrzeugschein des neuen Fahrzeugs.";',
    "replyText = t('fresh_start', language);",
    "fresh_start"
)

# Follow up fallback
do_replace(
    'replyText = language === "en"\n                ? "What part do you need for your vehicle?"\n                : "Welches Teil ben\u00f6tigen Sie f\u00fcr Ihr Fahrzeug?";',
    "replyText = t('follow_up_fallback', language);",
    "follow_up_fallback"
)

# Order complete
do_replace(
    'replyText = language === "en"\n              ? "Your order is complete. If you have further questions, just ask!"\n              : "Ihre Bestellung ist abgeschlossen. Wenn Sie weitere Fragen haben, fragen Sie einfach!";',
    "replyText = t('order_complete', language);",
    "order_complete"
)

with open(LOGIC, "w") as f:
    f.write(content)

print(f"\nStep 2: Replaced {count}/{total} inline strings")
remaining = content.count('language === "en"')
print(f"Remaining language === 'en' occurrences: {remaining}")
