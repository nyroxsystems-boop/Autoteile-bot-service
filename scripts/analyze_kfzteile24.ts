import { chromium } from 'playwright';

async function analyzeKFZTeile24() {
    console.log("🔍 Analyzing KFZTeile24 HTML structure...\n");

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'de-DE'
    });

    const page = await context.newPage();

    const url = 'https://www.kfzteile24.de/suche?search=8E0615301Q';
    console.log(`📍 Navigating to: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for page to load
    await page.waitForTimeout(10000);

    console.log("📊 Analyzing page structure...\n");

    // Try different selectors
    const selectors = [
        'article',
        '[data-product]',
        '[data-article]',
        '.product',
        '.productBox',
        '.item',
        '.result',
        '[class*="product"]',
        '[class*="item"]',
        '[class*="article"]'
    ];

    for (const selector of selectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
            console.log(`✅ Found ${count} elements with selector: ${selector}`);

            // Get first element's HTML
            const firstElement = page.locator(selector).first();
            const html = await firstElement.innerHTML().catch(() => '');

            if (html.length > 0 && html.length < 2000) {
                console.log(`\n📝 Sample HTML:\n${html.substring(0, 500)}...\n`);
            }
        }
    }

    // Check for price elements
    console.log("\n💰 Looking for price elements...\n");
    const priceSelectors = [
        '[data-price]',
        '.price',
        '[class*="price"]',
        '[class*="Price"]'
    ];

    for (const selector of priceSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
            console.log(`✅ Found ${count} price elements with: ${selector}`);
            const text = await page.locator(selector).first().textContent().catch(() => '');
            console.log(`   Sample text: "${text}"`);
        }
    }

    // Save screenshot
    await page.screenshot({ path: '/tmp/kfzteile24-analysis.png', fullPage: true });
    console.log("\n📸 Screenshot saved to /tmp/kfzteile24-analysis.png");

    // Save HTML
    const html = await page.content();
    require('fs').writeFileSync('/tmp/kfzteile24-analysis.html', html);
    console.log("💾 HTML saved to /tmp/kfzteile24-analysis.html");

    await browser.close();
    console.log("\n✅ Analysis complete!");
    process.exit(0);
}

analyzeKFZTeile24().catch(e => {
    console.error("❌ Error:", e);
    process.exit(1);
});
