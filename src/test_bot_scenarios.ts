import { handleIncomingBotMessage } from './services/botLogicService';
import { logger } from './utils/logger';

async function simulateConversation(from: string, messages: string[]) {
    console.log(`\n--- Starting Conversation for: ${from} ---`);
    let orderId: string | null = null;

    for (const text of messages) {
        console.log(`[USER]: ${text}`);
        const result = await handleIncomingBotMessage({
            from,
            text,
            orderId
        });
        orderId = result.orderId;
        console.log(`[BOT]: ${result.reply}`);
        if (result.contentSid) {
            console.log(`[BOT SYSTEM]: Sent Content API message (SID: ${result.contentSid})`);
        }
        console.log('-------------------------------------------');
    }
}

async function runTests() {
    // 1. Scenario: Happy Path with Home Delivery (German)
    await simulateConversation("whatsapp:+49111111", [
        "Hallo",                         // Welcome / Lang Selection
        "1",                             // Select German
        "Bremsscheiben für Audi A4 2018", // Vehicle/Part context (Partial)
        "VIN: WAUZZZ8K...",              // Full identification (Simulated)
        "Ja",                             // Vehicle Confirmation (New Requirement)
        "Ja, jetzt bestellen",           // Confirm single offer branch
        "D",                             // Delivery
        "Musterstraße 123, 10115 Berlin" // Address
    ]);

    // 2. Scenario: Pickup Choice
    await simulateConversation("whatsapp:+49222222", [
        "Hi, I need brakes for Golf 7",
        "2",                             // English
        "VIN: WVWZZZ...",
        "Yes",                           // Vehicle Confirmation
        "Yes, order now",
        "P"                              // Pickup
    ]);

    // 3. Scenario: Status Query (Existing Order)
    // First create an order, then ask status
    await simulateConversation("whatsapp:+49333333", [
        "1",                             // Language
        "Status von meiner Bestellung",   // Asking status
    ]);

    // 4. Scenario: Multi-language (Turkish)
    await simulateConversation("whatsapp:+49444444", [
        "3",                             // Turkish selection
        "Bremse"                         // Should reply in TR or fallback gracefully
    ]);

    // 5. STRESS TEST: Context Switching & Chaos
    await simulateConversation("whatsapp:+49555555", [
        "Hallo",
        "1",                             // German
        "Brauche Ölfilter für mein Auto",
        "Wann macht ihr eigentlich zu?",   // Out of context question
        "Achso ok. Und was ist mit meiner Bestellung von gestern?", // Status question mid-flow
        "BMW 3er, 2015",                  // Back to vehicle
        "Ich hab keinen Schein hier, geht's auch ohne VIN?", // Stubborn
        "Egal, such einfach"             // Pushy
    ]);

    // 6. STRESS TEST: Slang & Language Mix
    await simulateConversation("whatsapp:+49666666", [
        "Hey digga, brauch help with my Ride", // Slang mix
        "2",                             // English
        "Need some sick brakes for my GTI",
        "Was kostet der Spaß?",          // Language switch (German)
        "WVWZZZ123...",                  // VIN
        "Digger, liefert ihr auch nach Hause?", // Slang + Feature question
        "D",                             // Delivery
        "Meine Hood: Sonnenallee 1, Berlin" // Slang address
    ]);

    // 7. STRESS TEST: Abuse & Recovery
    await simulateConversation("whatsapp:+49777777", [
        "Du blöder Bot!",                // Insult
        "Sorry, war nicht so gemeint. Brauche Bremsen.", // Recovery
        "1",                             // Language
        "VIN: 12345"                     // Invalid VIN
    ]);

    // 8. STRESS TEST: The Conflictor (Conflicting data)
    await simulateConversation("whatsapp:+49888888", [
        "Hi, brauche Bremsen für meinen BMW M3",
        "1",                             // Language
        "Oh warte, ich meinte Audi A4",
        "Eigentlich ist es der Wagen von meiner Frau, ein VW Polo",
        "VIN: WAUZZZ..."                 // Audi VIN for the VW Polo claim
    ]);

    // 9. STRESS TEST: Gibberish & Loops
    await simulateConversation("whatsapp:+49999999", [
        "asdfghjkl",                     // Gibberish
        "1",                             // Language
        "?????",                         // Symbols
        "Ich brauche Hilfe",             // Vague
        "Hilfe",
        "HILFE!!!!"
    ]);

    // 10. STRESS TEST: Heavy Load / Part List
    await simulateConversation("whatsapp:+49000000", [
        "1",                             // Language
        "Ich brauche: 2x Bremsscheiben vorn, Bremsbeläge hinten links, einen Ölfilter, 5L 5W30 Öl, Zündkerzen für Zylinder 2 und 4, und den Scheibenwischer Beifahrerseite für meinen Audi A3 2.0 TDI Baujahr 2020 VIN: 123456789",
        "Ach ja, und einen Duftbaum Vanille" // Extra non-car part
    ]);

    // 11. SCENARIO: Vehicle rejection
    await simulateConversation("whatsapp:+49121212", [
        "1",                             // German
        "Bremsen für Golf 7",
        "Nein",                          // Rejects identification (loop test)
        "VIN: WAUZZZ..."                 // Provides correct info
    ]);
}

console.log("Starting Bot Scenario Simulation...");
runTests().then(() => {
    console.log("\nAll simulations completed.");
}).catch(err => {
    console.error("Simulation failed:", err);
});
