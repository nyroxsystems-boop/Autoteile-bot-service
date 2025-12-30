# Multi-stage build to minimize final image size
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm@9 && \
    PUPPETEER_SKIP_DOWNLOAD=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile --prod

# Copy source and prebuilt dist
COPY dist ./dist

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy node_modules and dist from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
