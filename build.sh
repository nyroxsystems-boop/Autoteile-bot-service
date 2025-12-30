#!/bin/bash
set -e

echo "==> Installing production dependencies (HTTP fallback for SSL issues)..."
PUPPETEER_SKIP_DOWNLOAD=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --omit=dev --no-audit --no-fund

echo "==> dist/ already contains prebuilt TypeScript"
echo "==> Build completed successfully!"
