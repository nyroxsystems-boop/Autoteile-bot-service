#!/usr/bin/env python3
"""Fix remaining inline language checks by reading actual file bytes."""
import re

FILE = "src/services/core/botLogicService.ts"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

original_count = content.count('language === "en"')
print(f"Before: {original_count} occurrences of language === \"en\"")

# Simple single-line replacements (exact text from file)
simple = {
    # part_mentioned (appears twice)
    '(language === "en" ? "the part you mentioned" : "das genannte Teil")':
        "t('part_mentioned', language)",
    
    # confirm_vehicle_yes (L2211)  
    """replyText = language === "en"
              ? "Great! Which part do you need? Please include position and symptoms."
              : t('collect_part', language);""":
        "replyText = t('confirm_vehicle_yes', language);",
    
    # delivery_or_pickup_ask
    """replyText = language === "en"
              ? "Please decide: Delivery (D) or Pickup (P)?"
              : "Bitte entscheide dich: Lieferung (D) oder Abholung (P)?";""":
        "replyText = t('delivery_or_pickup_ask', language);",
    
    # fresh_start
    """replyText = language === "en"
              ? "Sure! Send me a photo of the vehicle registration document for the new car."
              : "Klar! Schicken Sie mir ein Foto vom Fahrzeugschein des neuen Fahrzeugs.";""":
        "replyText = t('fresh_start', language);",
    
    # order_complete
    """replyText = language === "en"
              ? "Your order is complete. If you have further questions, just ask!"
              : "Ihre Bestellung ist abgeschlossen. Wenn Sie weitere Fragen haben, fragen Sie einfach!";""":
        "replyText = t('order_complete', language);",
}

count = 0
for old, new in simple.items():
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"  OK [{count}]: {new[:60]}")
    else:
        print(f"  MISS: {old[:60]}")

# Now handle smart-quote strings (use actual Unicode char \u2019)
SQ = "\u2019"  # right single quote

smart_replacements = {
    # offer_collecting (smart quotes in I'm and You'll)
    f"""language === "en"
                ? "I{SQ}m still collecting offers for you. You{SQ}ll get a selection shortly."
                : "Ich suche noch passende Angebote. Du bekommst gleich eine Auswahl.\"""":
        "t('offer_collecting', language)",
    
    # offer_fetch_failed
    f"""language === "en"
                ? "I couldn{SQ}t retrieve offers right now. I{SQ}ll update you soon."
                : "Ich konnte gerade keine Angebote abrufen. Ich melde mich bald erneut.\"""":
        "t('offer_fetch_failed', language)",
    
    # offer_choice_not_found
    f"""language === "en"
                ? "I couldn{SQ}t match your choice. I{SQ}ll show the offers again."
                : "Ich konnte deine Auswahl nicht zuordnen. Ich zeige dir die Angebote gleich erneut.\"""":
        "t('offer_choice_not_found', language)",
    
    # offer_confirm_prompt
    f"""language === "en"
                ? {SQ}If this offer works for you, please reply with "Yes" or "OK". If not, tell me what matters most (price, brand, delivery time).{SQ}
                : {SQ}Wenn das Angebot f\u00fcr Sie passt, antworten Sie bitte mit "Ja" oder "OK". Wenn nicht, sagen Sie mir kurz, was Ihnen wichtig ist (z.B. Preis, Marke oder Lieferzeit).{SQ}""":
        "t('offer_confirm_prompt', language)",
    
    # offer_decline_alt
    f"""language === "en"
                ? "Got it, I{SQ}ll see if I can find alternative offers. Tell me what matters most: price, brand or delivery time."
                : "Alles klar, ich schaue, ob ich Ihnen noch andere Angebote finden kann. Sagen Sie mir gerne, was Ihnen wichtiger ist: Preis, Marke oder Lieferzeit.\"""":
        "t('offer_decline_alt', language)",
    
    # offer_lost
    f"""language === "en"
                ? "I lost track of the offer. I{SQ}ll fetch the options again."
                : "Ich habe das Angebot nicht mehr parat. Ich hole die Optionen nochmal.\"""":
        "t('offer_lost', language)",
    
    # offer_not_found
    f"""language === "en"
                ? "I couldn{SQ}t find that offer anymore. I{SQ}ll show available offers again."
                : "Ich konnte dieses Angebot nicht mehr finden. Ich zeige dir die verf\u00fcgbaren Angebote erneut.\"""":
        "t('offer_not_found', language)",
    
    # address_saved
    f"""replyText = language === "en"
              ? "Thank you! Your delivery address has been saved. We will ship the part shortly."
              : "Vielen Dank! Deine Lieferadresse wurde gespeichert. Wir versenden das Teil in K\u00fcrze.";""":
        "replyText = t('address_saved', language);",
    
    # address_invalid
    f"""replyText = language === "en"
              ? "Please provide a valid delivery address."
              : "Bitte gib eine g\u00fcltige Lieferadresse an.";""":
        "replyText = t('address_invalid', language);",
    
    # follow_up_fallback
    f"""replyText = language === "en"
                ? "What part do you need for your vehicle?"
                : "Welches Teil ben\u00f6tigen Sie f\u00fcr Ihr Fahrzeug?";""":
        "replyText = t('follow_up_fallback', language);",
    
    # OCR success duplicate with EN branch
    f"""language === "en"
                      ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."
                      : t('ocr_success', language)""":
        "t('ocr_success', language)",
    
    f"""language === "en"
                  ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."
                  : t('ocr_success', language)""":
        "t('ocr_success', language)",
    
    # ask_vin_general duplicate
    f"""(language === "en"
                ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."
                : t('collect_vehicle_manual', language))""":
        "t('ask_vin_general', language)",
    
    # offer_choice_invalid
    f"""language === "en"
                ? 'Please reply with 1, 2 or 3 to pick one of the offers.'
                : 'Bitte antworte mit 1, 2 oder 3, um ein Angebot auszuw\u00e4hlen.'""":
        "t('offer_choice_invalid', language)",
    
    # Caution note check
    f"""cautious && language === "en"
            ? " (please double-check)"
            : \"\"""":
        "cautious ? t('caution_check', language) : \"\"",
}

for old, new in smart_replacements.items():
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"  OK [{count}]: {new[:60]}")
    else:
        print(f"  MISS: {old[:50]}...")

# Also handle remaining OCR duplicates with different whitespace
# And vehicle_correction / vehicle_confirm duplicates

# Vehicle correction (L2218-2220)
vc_old = f"""replyText = language === "en"
              ? "Oh, I{SQ}m sorry. Please send me a photo of your registration or the correct VIN so I can identify the right car."
              : "Oh, das tut mir leid. Bitte schicken Sie mir ein Foto vom Fahrzeugschein oder die korrekte VIN, damit ich das richtige Fahrzeug finden kann.";"""
vc_new = "replyText = t('vehicle_correction', language);"
if vc_old in content:
    content = content.replace(vc_old, vc_new)
    count += 1
    print(f"  OK [{count}]: vehicle_correction")
else:
    print(f"  MISS: vehicle_correction")

# Vehicle confirm duplicate (L2179-2181)
vcf_old = f"""replyText = language === "en"
              ? `I{SQ}ve identified your vehicle as ${{summary}}. Is this correct?`
              : `Ich habe Ihr Fahrzeug als ${{summary}} identifiziert. Ist das korrekt?`;"""
vcf_new = "replyText = tWith('vehicle_confirm', language, { summary });"
if vcf_old in content:
    content = content.replace(vcf_old, vcf_new)
    count += 1
    print(f"  OK [{count}]: vehicle_confirm duplicate")
else:
    print(f"  MISS: vehicle_confirm duplicate")

# OCR vin_missing duplicate (L2110-2113)
ovm_old = f"""replyText =
                  language === "en"
                    ? "I couldn{SQ}t read VIN or HSN/TSN. Please send those numbers or a clearer photo."
                    : "Ich konnte VIN oder HSN/TSN nicht sicher erkennen. Bitte schicken Sie mir die Nummern oder ein sch\u00e4rferes Foto.";"""
ovm_new = """replyText = t('ocr_vin_missing', language);"""
if ovm_old in content:
    content = content.replace(ovm_old, ovm_new)
    count += 1
    print(f"  OK [{count}]: ocr_vin_missing dup")
else:
    print(f"  MISS: ocr_vin_missing dup")

# ask_vin_general duplicate (L2119-2122)
avg_old = f"""replyText =
                  language === "en"
                    ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."
                    : t('collect_vehicle_manual', language);"""
avg_new = """replyText = t('ask_vin_general', language);"""
if avg_old in content:
    content = content.replace(avg_old, avg_new)
    count += 1
    print(f"  OK [{count}]: ask_vin_general dup")
else:
    print(f"  MISS: ask_vin_general dup")

# Delivery ask_address (L2611)
dad_old = f"""replyText = language === "en"
              ? "Excellent choice. Please send me your full delivery address."
              : "Sehr gute Wahl. Bitte sende mir nun deine vollst\u00e4ndige Lieferadresse.";"""
dad_new = "replyText = t('delivery_ask_address', language);"
if dad_old in content:
    content = content.replace(dad_old, dad_new)
    count += 1
    print(f"  OK [{count}]: delivery_ask_address")
else:
    print(f"  MISS: delivery_ask_address")

# Goodbye (L2699-2701)
gb_old = f"""replyText = language === "en"
              ? "Thank you! If you need anything else, just write me anytime. \U0001f44b"
              : "Vielen Dank! Wenn du noch etwas brauchst, schreib mir jederzeit. \U0001f44b";"""
gb_new = "replyText = t('goodbye', language);"
if gb_old in content:
    content = content.replace(gb_old, gb_new)
    count += 1
    print(f"  OK [{count}]: goodbye")
else:
    print(f"  MISS: goodbye")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

after_count = content.count('language === "en"')
print(f"\nAfter: {after_count} occurrences of language === \"en\" (was {original_count})")
print(f"Total replaced: {count}")
