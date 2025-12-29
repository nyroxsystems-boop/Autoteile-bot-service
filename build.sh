#!/bin/bash
set -e

echo "==> Installing pnpm via standalone installer..."
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=9.15.4 sh -

# Add pnpm to PATH for this session
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

echo "==> Installing dependencies with pnpm..."
PUPPETEER_SKIP_DOWNLOAD=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile

echo "==> Building TypeScript..."
pnpm run build

echo "==> Build completed successfully!"
