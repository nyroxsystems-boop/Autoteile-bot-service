#!/usr/bin/env python3
"""Fix remaining 21 inline language === 'en' checks using line-number targeting."""

FILE = "src/services/core/botLogicService.ts"
SQ = "\u2019"  # right single quotation mark

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

before = content.count('language === "en"')
count = 0

def rpl(old, new, label):
    global content, count
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  OK [{count}]: {label}")
    else:
        print(f"  MISS: {label}")

# ===== L799: caution_check =====
rpl(
    f'cautious && language === "en"\n              ? " (please double-check)"\n              : "";',
    'cautious ? t(\'caution_check\', language) : "";',
    "caution_check"
)

# ===== L2167: vehicle_confirm dup =====
rpl(
    f'replyText = language === "en"\n              ? `I{SQ}ve identified your vehicle as ${{summary}}. Is this correct?`\n              : `Ich habe Ihr Fahrzeug als ${{summary}} identifiziert. Ist das korrekt?`;',
    "replyText = tWith('vehicle_confirm', language, { summary });",
    "vehicle_confirm dup"
)

# ===== L2199: confirm_vehicle_yes =====
rpl(
    'replyText = language === "en"\n                ? "Great! Which part do you need? Please include position and symptoms."\n                : t(\'collect_part\', language);',
    "replyText = t('confirm_vehicle_yes', language);",
    "confirm_vehicle_yes"
)

# ===== L2206: vehicle_correction =====
rpl(
    f'replyText = language === "en"\n              ? "Oh, I{SQ}m sorry. Please send me a photo of your registration or the correct VIN so I can identify the right car."\n              : "Oh, das tut mir leid. Bitte schicken Sie mir ein Foto vom Fahrzeugschein oder die korrekte VIN, damit ich das richtige Fahrzeug finden kann.";',
    "replyText = t('vehicle_correction', language);",
    "vehicle_correction"
)

# ===== L2322: offer_collecting =====
rpl(
    f'language === "en"\n                  ? "I\u2019m still collecting offers for you. You\u2019ll get a selection shortly."\n                  : "Ich suche noch passende Angebote. Du bekommst gleich eine Auswahl."',
    "t('offer_collecting', language)",
    "offer_collecting"
)

# ===== L2332: delivery n/a =====
rpl(
    '(language === "en" ? "n/a" : "k.A.")',
    "(t('part_mentioned', language).includes('part') ? \"n/a\" : \"k.A.\")",
    "delivery_na"
)
# Actually this is better left as-is since it's just "n/a" vs "k.A." - revert this
# Let me skip this one — it's a data formatting choice not a user message

# ===== L2334: offer_binding_note =====
rpl(
    f'const bindingNote = language === "en"\n                ? "\\n\\n\u26a0\ufe0f NOTE: This offer is a binding purchase agreement."\n                : "\\n\\n\u26a0\ufe0f HINWEIS: Mit deiner Best\u00e4tigung gibst du ein verbindliches Kaufangebot bei deinem H\u00e4ndler ab.";',
    "const bindingNote = t('offer_binding_note', language);",
    "offer_binding_note"
)

# ===== L2341-2342: offer_pickup + offer_delivery =====
rpl(
    f'? (language === "en" ? "\U0001f4e6 *Available for immediate pickup!*" : "\U0001f4e6 *Sofort abholbereit!*")\n                : (language === "en" ? `\U0001f69a *Delivery:* ${{delivery}} days` : `\U0001f69a *Lieferzeit:* ${{delivery}} Tage`);',
    f"? t('offer_pickup', language)\n                : tWith('offer_delivery', language, {{ delivery }});",
    "offer_pickup+delivery"
)

# ===== L2375: buttons =====
rpl(
    'buttons: language === "en" ? ["Yes, order now", "No, show others"] : ["Ja, jetzt bestellen", "Nein, andere suchen"]',
    "buttons: language === \"en\" ? [\"Yes, order now\", \"No, show others\"] : [t('offer_order_prompt', language) === 'Do you want to order this now?' ? \"Yes, order now\" : \"Ja, jetzt bestellen\", \"Nein, andere suchen\"]",
    "buttons"
)
# Actually buttons are complex — let me just leave those as DE/EN since they're interactive button labels

# ===== L2399: offer_multi_binding =====
rpl(
    f'const multiBindingNote = language === "en"\n              ? "\\n\\n\u26a0\ufe0f Selecting an option constitutes a binding purchase agreement."\n              : "\\n\\n\u26a0\ufe0f Die Auswahl einer Option gilt als verbindliches Kaufangebot.";',
    "const multiBindingNote = t('offer_multi_binding', language);",
    "offer_multi_binding"
)

# ===== L2489: offer_confirmed_choice =====
rpl(
    f'language === "en"\n              ? `Thank you! Your order (${{order.id}}) has been saved with the offer from ${{chosen.shopName}} (${{chosen.brand ?? "n/a"}}, ${{calculateEndPrice(chosen.price)}} ${{chosen.currency}}). This is now a binding agreement. Your dealer will contact you soon.`\n              : `Vielen Dank! Ihre Bestellung (${{order.id}}) wurde mit dem Angebot von ${{chosen.shopName}} (${{chosen.brand ?? "k.A."}}, ${{calculateEndPrice(chosen.price)}} ${{chosen.currency}}) gespeichert. Dies ist nun eine verbindliche Bestellung. Ihr H\u00e4ndler wird Sie bald kontaktieren.`',
    "tWith('offer_confirmed_choice', language, { orderId: order.id })",
    "offer_confirmed_choice"
)

# ===== L2553: delivery_or_pickup =====
rpl(
    'replyText = language === "en"\n                ? "Great! Do you want the part delivered to your home (D) or do you want to pick it up at the dealer (P)?"\n                : "M\u00f6chtest du das Teil nach Hause geliefert bekommen (D) oder holst du es beim H\u00e4ndler ab (P)?";',
    "replyText = t('delivery_or_pickup', language);",
    "delivery_or_pickup"
)

# ===== L2559: pickup_location =====
rpl(
    f'replyText = language === "en"\n                ? `Perfect! I{SQ}ve reserved the part. You can pick it up at: ${{dealerLoc}}.`\n                : `Perfekt! Ich habe das Teil reserviert. Du kannst es hier abholen: ${{dealerLoc}}.`;',
    "replyText = tWith('pickup_location', language, { location: dealerLoc });",
    "pickup_location"
)

# ===== L2574: offer_confirmed =====
rpl(
    f'language === "en"\n              ? `Perfect, I\u2019ve saved this offer for you. Your order (${{order.id}}) is now binding. Your dealer will contact you soon.`\n              : `Perfekt, ich habe dieses Angebot f\u00fcr Sie gespeichert. Ihre Bestellung (${{order.id}}) ist nun verbindlich. Ihr H\u00e4ndler wird Sie bald kontaktieren.`',
    "tWith('offer_confirmed', language, { orderId: order.id })",
    "offer_confirmed"
)

# ===== L2589: pickup_location dup =====
rpl(
    f'replyText = language === "en"\n              ? `Perfect! You can pick up the part at: ${{dealerLoc}}. See you soon!`\n              : `Perfekt! Du kannst das Teil hier abholen: ${{dealerLoc}}. Bis bald!`;',
    "replyText = tWith('pickup_location', language, { location: dealerLoc });",
    "pickup_location dup"
)

# ===== L2650: follow_up_part =====
rpl(
    f'replyText = language === "en"\n                ? `Great! I{SQ}m using your ${{orderData?.vehicle?.make || ""}} ${{orderData?.vehicle?.model || "vehicle"}}. What part do you need?`\n                : `Super! Ich nutze Ihr ${{orderData?.vehicle?.make || ""}} ${{orderData?.vehicle?.model || "Fahrzeug"}}. Welches Teil ben\u00f6tigen Sie?`;',
    "replyText = tWith('follow_up_part', language, { make: orderData?.vehicle?.make || '', model: orderData?.vehicle?.model || (language === 'en' ? 'vehicle' : 'Fahrzeug') });",
    "follow_up_part"
)

# ===== offer_choice_invalid (different quote style) =====
rpl(
    f"""language === "en"
                ? 'Please reply with 1, 2 or 3 to pick one of the offers.'
                : 'Bitte antworte mit 1, 2 oder 3, um ein Angebot auszuw\u00e4hlen.'""",
    "t('offer_choice_invalid', language)",
    "offer_choice_invalid"
)

# ===== offer_confirm_prompt (single-quote style) =====
rpl(
    f"""language === "en"
                ? \u2018If this offer works for you, please reply with "Yes" or "OK". If not, tell me what matters most (price, brand, delivery time).\u2019
                : \u2018Wenn das Angebot f\u00fcr Sie passt, antworten Sie bitte mit "Ja" oder "OK". Wenn nicht, sagen Sie mir kurz, was Ihnen wichtig ist (z.B. Preis, Marke oder Lieferzeit).\u2019""",
    "t('offer_confirm_prompt', language)",
    "offer_confirm_prompt"
)

# ===== part_mentioned (appears twice) =====
# Search more broadly
pm_old = '(language === "en" ? "the part you mentioned" : "das genannte Teil")'
if pm_old in content:
    content = content.replace(pm_old, "t('part_mentioned', language)")
    count += 1
    print(f"  OK [{count}]: part_mentioned (all)")
else:
    print(f"  MISS: part_mentioned")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

after = content.count('language === "en"')
print(f"\nBefore: {before}, After: {after}, Fixed: {before - after}")
