import { chromium } from "@playwright/test";

export interface ScrapeRequestBody {
  oemNumber: string;
  connectionId?: string;
  config: {
    loginUrl: string;
    username?: string;
    password?: string;
    usernameSelector?: string;
    passwordSelector?: string;
    loginButtonSelector?: string;
    searchUrl?: string;
    searchFieldSelector: string;
    searchSubmitSelector: string;
    resultRowSelector: string;
    resultTitleSelector?: string;
    resultBrandSelector?: string;
    resultModelSelector?: string;
    resultOemSelector?: string;
    resultPriceSelector?: string;
    resultCurrencySelector?: string;
    resultAvailableQtySelector?: string;
    resultDeliveryTimeSelector?: string;
  };
}

export interface ScrapedInventoryItem {
  oemNumber: string;
  title?: string;
  brand?: string;
  model?: string;
  price?: number;
  currency?: string;
  availableQuantity?: number;
  deliveryTime?: string;
  rawText?: string;
}

function clean(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

function parseNumber(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function scrapeWwsInventoryByOem(req: ScrapeRequestBody): Promise<ScrapedInventoryItem[]> {
  const { config } = req;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(config.loginUrl, { waitUntil: "networkidle" });

    // Optionaler Login, abhängig von der Zielseite und den gepflegten Selektoren
    if (config.usernameSelector && config.passwordSelector && config.username && config.password) {
      await page.fill(config.usernameSelector, config.username);
      await page.fill(config.passwordSelector, config.password);
      if (config.loginButtonSelector) {
        await page.click(config.loginButtonSelector);
        await page.waitForLoadState("networkidle");
      }
    }

    // Optional zur Suchseite navigieren, falls getrennt vom Login
    if (config.searchUrl && config.searchUrl !== config.loginUrl) {
      await page.goto(config.searchUrl, { waitUntil: "networkidle" });
    }

    await page.fill(config.searchFieldSelector, req.oemNumber);
    await page.click(config.searchSubmitSelector);

    // Wartelogik je nach System evtl. anpassen (Selectors, Timeouts)
    await page.waitForTimeout(1000);

    const rows = await page.$$(config.resultRowSelector);
    const items: ScrapedInventoryItem[] = [];

    for (const row of rows) {
      const rawText = clean(await row.innerText());
      const titleText = config.resultTitleSelector
        ? await row.$eval(config.resultTitleSelector, (el) => el.textContent || "")
        : undefined;
      const brandText = config.resultBrandSelector
        ? await row.$eval(config.resultBrandSelector, (el) => el.textContent || "")
        : undefined;
      const modelText = config.resultModelSelector
        ? await row.$eval(config.resultModelSelector, (el) => el.textContent || "")
        : undefined;
      const oemText = config.resultOemSelector
        ? await row.$eval(config.resultOemSelector, (el) => el.textContent || "")
        : undefined;
      const priceText = config.resultPriceSelector
        ? await row.$eval(config.resultPriceSelector, (el) => el.textContent || "")
        : undefined;
      const currencyText = config.resultCurrencySelector
        ? await row.$eval(config.resultCurrencySelector, (el) => el.textContent || "")
        : undefined;
      const qtyText = config.resultAvailableQtySelector
        ? await row.$eval(config.resultAvailableQtySelector, (el) => el.textContent || "")
        : undefined;
      const deliveryText = config.resultDeliveryTimeSelector
        ? await row.$eval(config.resultDeliveryTimeSelector, (el) => el.textContent || "")
        : undefined;

      const price = parseNumber(priceText);
      const availableQuantity = parseNumber(qtyText);

      items.push({
        oemNumber: clean(oemText) || req.oemNumber,
        title: clean(titleText),
        brand: clean(brandText),
        model: clean(modelText),
        price,
        currency: clean(currencyText),
        availableQuantity,
        deliveryTime: clean(deliveryText),
        rawText
      });
    }

    return items;
  } finally {
    await browser.close();
  }
}

// Hinweise:
// - Selektoren und Timeouts müssen pro Ziel-WWS in connection.config gepflegt werden.
// - Zugangsdaten sollten langfristig nicht im Klartext in JSON stehen (DB + Encryption).
// - Scraping muss rechtlich/vertraglich mit dem Zielsystem abgestimmt sein.
