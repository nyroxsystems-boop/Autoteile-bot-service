#!/bin/bash
set -e

echo "==> Installing pnpm..."
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=9.15.4 sh -
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

echo "==> Installing production dependencies with pnpm..."
PUPPETEER_SKIP_DOWNLOAD=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --prod --frozen-lockfile

echo "==> dist/ already contains prebuilt TypeScript"
echo "==> Build completed successfully!"
