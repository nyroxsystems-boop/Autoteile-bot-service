#!/usr/bin/env python3
"""v6 final: Typing indicator + OEM-Direkt status fix."""

# ============================================================================
# 1. botQueue.ts — Add messageSid to BotJobData
# ============================================================================
BQ = "src/queue/botQueue.ts"
with open(BQ, "r", encoding="utf-8") as f:
    bq = f.read()

if "messageSid" not in bq:
    bq = bq.replace(
        "    mediaUrls?: string[];",
        "    mediaUrls?: string[];\n    messageSid?: string; // Twilio MessageSid for typing indicator"
    )
    with open(BQ, "w", encoding="utf-8") as f:
        f.write(bq)
    print("OK [1]: BotJobData — added messageSid")
else:
    print("SKIP [1]: BotJobData — already has messageSid")

# ============================================================================
# 2. whatsappWebhook.ts — Capture MessageSid
# ============================================================================
WH = "src/routes/whatsappWebhook.ts"
with open(WH, "r", encoding="utf-8") as f:
    wh = f.read()

if "MessageSid" not in wh:
    wh = wh.replace(
        'const from = (req.body?.From as string) || "";',
        'const from = (req.body?.From as string) || "";\n  const messageSid = (req.body?.MessageSid as string) || "";'
    )
    wh = wh.replace(
        '      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined',
        '      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,\n      messageSid: messageSid || undefined'
    )
    with open(WH, "w", encoding="utf-8") as f:
        f.write(wh)
    print("OK [2]: Webhook — captures MessageSid")
else:
    print("SKIP [2]: Webhook — already captures MessageSid")

# ============================================================================
# 3. botWorker.ts — Add typing indicator function + call before processing
# ============================================================================
BW = "src/queue/botWorker.ts"
with open(BW, "r", encoding="utf-8") as f:
    bw = f.read()

if "sendTypingIndicator" not in bw:
    # Add axios import + typing function after sendTwilioReply
    typing_fn = '''
// ============================================================================
// Typing Indicator — shows "typing..." in WhatsApp before bot responds
// Uses Twilio REST API (Public Beta, Oct 2025)
// ============================================================================
async function sendTypingIndicator(messageSid: string | undefined): Promise<void> {
    if (!messageSid || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
    
    try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${messageSid}/UserDefinedMessages.json`;
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        
        // Send read receipt + typing indicator via Twilio UserDefinedMessages
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'IdempotencyKey=typing-' + messageSid + '&Content=' + encodeURIComponent(JSON.stringify({ type: "typing_started" })),
        });

        if (response.ok) {
            logger.info("⌨️ Typing indicator sent", { messageSid: messageSid.substring(0, 12) });
        }
    } catch (err: any) {
        // Non-fatal: typing indicator failure should never block message processing
        logger.debug("[BotWorker] Typing indicator failed (non-blocking)", { error: err?.message });
    }
}
'''
    bw = bw.replace(
        "// ============================================================================\n// #2 FIX: Worker with exponential backoff",
        typing_fn + "\n// ============================================================================\n// #2 FIX: Worker with exponential backoff"
    )
    
    # Extract messageSid from job data
    bw = bw.replace(
        "const { from, text, orderId, mediaUrls } = job.data;",
        "const { from, text, orderId, mediaUrls, messageSid } = job.data;"
    )
    
    # Call typing indicator before processing
    bw = bw.replace(
        "        try {\n            // ============================================================\n            // #1 FIX: Pass sendInterimReply callback",
        "        // Send typing indicator immediately (non-blocking)\n        sendTypingIndicator(messageSid).catch(() => {});\n\n        try {\n            // ============================================================\n            // #1 FIX: Pass sendInterimReply callback"
    )
    
    with open(BW, "w", encoding="utf-8") as f:
        f.write(bw)
    print("OK [3]: botWorker — typing indicator function + call added")
else:
    print("SKIP [3]: botWorker — already has typing indicator")

# ============================================================================
# 4. OEM-Direkt — Update order status to show_offers after successful scraping
# ============================================================================
BL = "src/services/core/botLogicService.ts"
with open(BL, "r", encoding="utf-8") as f:
    bl = f.read()

count = 0

# After successful OEM direct scraping, transition to show_offers
old_oem_found = """          if (scrapeResult && scrapeResult.length > 0) {
            return {
              reply: tWith('oem_direct_found', language, { oem: extractedOem, count: String(scrapeResult.length) }),
              orderId: order.id
            };"""
new_oem_found = """          if (scrapeResult && scrapeResult.length > 0) {
            await updateOrder(order.id, { status: "show_offers" as ConversationStatus });
            return {
              reply: tWith('oem_direct_found', language, { oem: extractedOem, count: String(scrapeResult.length) }),
              orderId: order.id
            };"""
if old_oem_found in bl:
    bl = bl.replace(old_oem_found, new_oem_found, 1)
    count += 1
    print(f"OK [4]: OEM-Direkt — status → show_offers after successful scraping")

with open(BL, "w", encoding="utf-8") as f:
    f.write(bl)

print(f"\nDone. OEM fixes: {count}")
