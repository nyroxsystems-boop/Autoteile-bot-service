import dotenv from 'dotenv';
dotenv.config();

import { handleIncomingBotMessage } from '../src/services/botLogicService';

async function main() {
  const payload = {
    from: process.env.TEST_WHATSAPP_FROM || 'whatsapp:+491701234567',
    text: process.env.TEST_WHATSAPP_TEXT || 'Bremsscheiben vorne',
    mediaUrls: undefined
  };

  console.log('Running live simulated WhatsApp payload:', payload);
  try {
    const res = await handleIncomingBotMessage(payload as any);
    console.log('Simulated bot response:', res);
  } catch (err: any) {
    console.error('Simulated run failed:', err?.message ?? err);
    process.exit(1);
  }
}

main();
