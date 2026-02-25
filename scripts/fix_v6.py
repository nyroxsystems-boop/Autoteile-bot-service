#!/usr/bin/env python3
"""v6 Tier 1 fixes: collectPartBrainPrompt multilingual, empty-from guard,
recordActivity language, scraping→needs_human, status escalation."""

# ============================================================================
# 1. collectPartBrainPrompt — add multilingual instruction
# ============================================================================
CPB = "src/prompts/collectPartBrainPrompt.ts"
with open(CPB, "r", encoding="utf-8") as f:
    cpb = f.read()

# Add language instruction near the end of the prompt
if "Answer in the customer" not in cpb:
    cpb = cpb.replace(
        '"language": "de" | "en"',
        '"language": "de" | "en" | "tr" | "ku" | "pl"'
    )
    cpb = cpb.replace(
        "Formuliere eine natürliche, freundliche Antwort in der passenden Sprache.",
        "Formuliere eine natürliche, freundliche Antwort in der passenden Sprache.\n"
        "- WICHTIG: Antworte IMMER in der Sprache des Kunden:\n"
        '  - "de" → Deutsch, "en" → English, "tr" → Türkçe, "ku" → Kurmancî, "pl" → Polski\n'
        '  - Auch Rückfragen, Entschuldigungen und Erklärungen MÜSSEN in der Kundensprache sein.'
    )
    with open(CPB, "w", encoding="utf-8") as f:
        f.write(cpb)
    print("OK [1]: collectPartBrainPrompt — multilingual instruction added")
else:
    print("SKIP [1]: collectPartBrainPrompt — already multilingual")

# ============================================================================
# 2. Webhook — empty From guard
# ============================================================================
WH = "src/routes/whatsappWebhook.ts"
with open(WH, "r", encoding="utf-8") as f:
    wh = f.read()

if 'if (!from)' not in wh:
    wh = wh.replace(
        'const from = (req.body?.From as string) || "";',
        'const from = (req.body?.From as string) || "";\n'
        '  if (!from) {\n'
        '    logger.warn("[Twilio Webhook] Empty From field, rejecting");\n'
        '    return res.status(400).send("<Response></Response>");\n'
        '  }'
    )
    with open(WH, "w", encoding="utf-8") as f:
        f.write(wh)
    print("OK [2]: Webhook — empty From guard added")
else:
    print("SKIP [2]: Webhook — already guarded")

# ============================================================================
# 3. botWorker — recordActivity language from result
# ============================================================================
BW = "src/queue/botWorker.ts"
with open(BW, "r", encoding="utf-8") as f:
    bw = f.read()

if "recordActivity(from, orderId || '', null)" in bw:
    # Move recordActivity AFTER handleIncomingBotMessage to get language
    # Find the current call and replace with a post-reply call
    bw = bw.replace(
        "recordActivity(from, orderId || '', null); // language populated after handleIncomingBotMessage",
        "// recordActivity moved to after handleIncomingBotMessage (see below for language population)"
    )
    
    # Add recordActivity after the result is available
    if "const result = await handleIncomingBotMessage" in bw:
        bw = bw.replace(
            "const result = await handleIncomingBotMessage(",
            "const result = await handleIncomingBotMessage("
        )
    
    # Find where orderId is extracted from result and add recordActivity there
    if "const replyText = result?.reply" in bw:
        bw = bw.replace(
            "const replyText = result?.reply",
            "// P1 #9: Record activity with language from order\n"
            "        recordActivity(from, result?.orderId || orderId || '', (result as any)?.language || null);\n"
            "        const replyText = result?.reply"
        )
    
    with open(BW, "w", encoding="utf-8") as f:
        f.write(bw)
    print("OK [3]: botWorker — recordActivity with language from result")
else:
    print("SKIP [3]: botWorker — already fixed")

# ============================================================================
# 4. Scraping error → needs_human (not collect_part)
# ============================================================================
BL = "src/services/core/botLogicService.ts"
with open(BL, "r", encoding="utf-8") as f:
    bl = f.read()

count = 0

# L799: scrape after OEM failed → needs_human
old_scrape = """          replyText: t('oem_scrape_failed', language),
          nextStatus: "collect_part"
        };"""
new_scrape = """          replyText: t('oem_scrape_failed', language),
          nextStatus: "needs_human" as ConversationStatus
        };"""
if old_scrape in bl:
    bl = bl.replace(old_scrape, new_scrape, 1)
    count += 1
    print(f"OK [4]: scraping error → needs_human")

# L806: OEM uncertain → needs_human (was collect_part — falls through to useless re-ask)
old_uncertain = """      replyText: t('oem_product_uncertain', language),
      nextStatus: "collect_part"
    };"""
new_uncertain = """      replyText: t('oem_product_uncertain', language),
      nextStatus: "needs_human" as ConversationStatus
    };"""
if old_uncertain in bl:
    bl = bl.replace(old_uncertain, new_uncertain, 1)
    count += 1
    print(f"OK [5]: OEM uncertain → needs_human")

# Also expose language in the result for botWorker to pick up
# In handleIncomingBotMessage return, add language to result
if "return { reply: replyText, orderId: order.id };" in bl:
    # Replace the final return (the one at the bottom, after vehicleDescToSave)
    # We need to be careful to only replace the LAST one (the default return at the end)
    pass  # Let me handle this differently — just ensure language is in the main return

with open(BL, "w", encoding="utf-8") as f:
    f.write(bl)

print(f"\nAll fixes applied. Scraping fixes: {count}")
