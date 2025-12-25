# Autoteile Assistant - bot-service

This service handles WhatsApp incoming messages, OCR/vehicle extraction, AI orchestration, OEM resolution and scraping supplier offers.

## Running the test suite

Install dependencies and run tests:

```bash
cd bot-service
npm install
npm test -- --runInBand
```

## Live Apify test (optional)

If you want to run a live Apify actor as a smoke test (this executes a real Apify actor and requires credentials), set the following environment variables in your shell or in a `.env` file:

- APIFY_TOKEN: your Apify API token
- APIFY_ACTOR_ID: (optional) the actor id to run, default `making-data-meaningful/tecdoc`
- TEST_OEM: (optional) OEM number to pass as actor input
- TEST_COUNTRY: (optional) country e.g. `DE`

Then run:

```bash
# from repository root
cd bot-service
npx ts-node scripts/run-live-apify-test.ts
```

The script will print the dataset items returned by the actor. Keep in mind this performs live requests and may consume credits/quota on your Apify account.
