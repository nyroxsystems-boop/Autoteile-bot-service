# ScraperAPI Setup für 100% zuverlässiges Scraping

## Option 1: ScraperAPI (Empfohlen)

ScraperAPI ist ein professioneller Service, der alle Anti-Bot-Maßnahmen umgeht:
- Automatische CAPTCHA-Lösung
- Proxy-Rotation
- JavaScript-Rendering
- 99.9% Erfolgsrate

### Setup:
1. Registriere dich auf https://www.scraperapi.com
2. Hole deinen API-Key aus dem Dashboard
3. Setze die Umgebungsvariable:
   ```bash
   export SCRAPER_API_KEY="dein_api_key_hier"
   ```

### Preise:
- **Free Tier**: 5.000 Requests/Monat (gut für Tests)
- **Hobby**: $49/Monat - 100.000 Requests
- **Startup**: $149/Monat - 500.000 Requests

## Option 2: Apify

Alternative professionelle Scraping-Plattform:

```bash
export APIFY_TOKEN="dein_token"
export APIFY_SHOP_ACTORS='[{"shopName":"Autodoc","actorId":"actor_id_hier"}]'
```

## Ohne API-Key

Ohne einen der beiden Services wird das Scraping **nicht funktionieren**, da moderne E-Commerce-Seiten aggressive Bot-Schutz-Systeme haben.

Das System zeigt beim Start eine Fehlermeldung, wenn kein Scraping-Service konfiguriert ist.
