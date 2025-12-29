#!/bin/bash
set -e

echo "==> Installing pnpm..."
npm install -g pnpm@9

echo "==> Installing dependencies with pnpm..."
PUPPETEER_SKIP_DOWNLOAD=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile

echo "==> Building TypeScript..."
npm run build

echo "==> Build completed successfully!"
