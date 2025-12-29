#!/bin/bash
set -e

echo "==> Installing dependencies..."
npm ci

echo "==> Building TypeScript..."
npm run build

echo "==> Build completed successfully!"
