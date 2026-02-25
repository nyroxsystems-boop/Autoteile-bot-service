#!/usr/bin/env python3
"""Final pass: fix remaining 10 + revert bad hacks."""

FILE = "src/services/core/botLogicService.ts"
SQ = "\u2019"

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

# ===== REVERT: delivery_na hack was incorrect =====
rpl(
    "(t('part_mentioned', language).includes('part') ? \"n/a\" : \"k.A.\")",
    '(language === "en" ? "n/a" : "k.A.")',
    "REVERT delivery_na"
)

# ===== REVERT: buttons hack was incorrect =====
rpl(
    """buttons: language === "en" ? ["Yes, order now", "No, show others"] : [t('offer_order_prompt', language) === 'Do you want to order this now?' ? "Yes, order now" : "Ja, jetzt bestellen", "Nein, andere suchen"]""",
    """buttons: language === "en" ? ["Yes, order now", "No, show others"] : ["Ja, jetzt bestellen", "Nein, andere suchen"]""",
    "REVERT buttons"
)

# ===== L2165: vehicle_confirm dup (different ') =====
# The file uses \' not smart quote here
rpl(
    """replyText = language === "en"
              ? `I\\'ve identified your vehicle as ${summary}. Is this correct?`
              : `Ich habe Ihr Fahrzeug als ${summary} identifiziert. Ist das korrekt?`;""",
    "replyText = tWith('vehicle_confirm', language, { summary });",
    "vehicle_confirm dup (escaped)"
)

# ===== L2202: vehicle_correction (different ') =====
rpl(
    """replyText = language === "en"
              ? "Oh, I\\'m sorry. Please send me a photo of your registration or the correct VIN so I can identify the right car."
              : "Oh, das tut mir leid. Bitte schicken Sie mir ein Foto vom Fahrzeugschein oder die korrekte VIN, damit ich das richtige Fahrzeug finden kann.";""",
    "replyText = t('vehicle_correction', language);",
    "vehicle_correction (escaped)"
)

# ===== L2541: delivery_or_pickup =====
rpl(
    """replyText = language === "en"
                ? "Great! Do you want the part delivered to your home (D) or do you want to pick it up at the dealer (P)?"
                : "Super! M\u00f6chtest du das Teil nach Hause geliefert bekommen (D) oder holst du es beim H\u00e4ndler ab (P)?";""",
    "replyText = t('delivery_or_pickup', language);",
    "delivery_or_pickup"
)

# ===== L2547: pickup_location =====
rpl(
    """replyText = language === "en"
                ? `Perfect! I\\'ve reserved the part. You can pick it up at: ${dealerLoc}.`
                : `Perfekt! Ich habe das Teil reserviert. Du kannst es hier abholen: ${dealerLoc}.`;""",
    "replyText = tWith('pickup_location', language, { location: dealerLoc });",
    "pickup_location"
)

# ===== L2634: follow_up_part =====
rpl(
    """replyText = language === "en"
                ? `Great! I\\'m using your ${orderData?.vehicle?.make || ""} ${orderData?.vehicle?.model || "vehicle"}. What part do you need?`
                : `Super! Ich nutze Ihr ${orderData?.vehicle?.make || ""} ${orderData?.vehicle?.model || "Fahrzeug"}. Welches Teil ben\u00f6tigen Sie?`;""",
    "replyText = tWith('follow_up_part', language, { make: orderData?.vehicle?.make || '', model: orderData?.vehicle?.model || '' });",
    "follow_up_part"
)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

after = content.count('language === "en"')
print(f"\nBefore: {before}, After: {after}, Fixed (net): {before - after}")
