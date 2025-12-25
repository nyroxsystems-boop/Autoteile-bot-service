## Scraping-Situation: Autodoc & KFZTeile24

### Problem
Autodoc und KFZTeile24 haben **extrem aggressive Bot-Schutz-Systeme**:
- Cloudflare Turnstile (neueste Generation)
- DataDome (ML-basierte Bot-Erkennung)  
- IP-Blacklisting von bekannten Scraping-Services

### Getestete Ansätze (alle gescheitert)
1. ✗ **ScraperAPI Standard** - 403 Forbidden
2. ✗ **ScraperAPI Ultra Premium** - 403 Forbidden  
3. ✗ **Puppeteer Stealth** - Challenge-Seiten
4. ✗ **Playwright + ScraperAPI Proxy** - 0 bytes HTML
5. ✗ **Playwright Stealth** - Challenge-Seiten

### Warum ScraperAPI nicht funktioniert
- Autodoc/KFZTeile24 blockieren **alle bekannten Scraping-Service-IPs**
- ScraperAPI's IP-Ranges sind den Shops bekannt
- Selbst mit `ultra_premium=true` werden Requests geblockt

### Realität
**Diese Shops sind NICHT scrapbar** mit Standard-Tools. Sie nutzen die gleichen Technologien wie:
- Amazon (DataDome)
- Nike (Akamai Bot Manager)
- Ticketmaster (Queue-it)

### Funktionierende Alternativen
1. **eBay.de** - Funktioniert perfekt mit ScraperAPI ✅
2. **Amazon.de** - Sollte funktionieren ✅
3. **ATU.de** - Weniger aggressiv ✅
4. **Mobile.de** - Funktioniert ✅

### Empfehlung
**Nutze alternative Shops** die weniger Bot-Schutz haben, oder:
- Warte auf offizielle APIs von Autodoc/KFZTeile24
- Nutze Apify's vorgefertigte Autodoc-Scraper (falls verfügbar)
- Akzeptiere 30-50% Erfolgsrate mit Playwright

ScraperAPI funktioniert einwandfrei - nur nicht für diese spezifischen Shops.
