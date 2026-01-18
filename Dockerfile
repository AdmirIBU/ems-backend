# build stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
ENV \
	npm_config_fetch_retries=5 \
	npm_config_fetch_retry_mintimeout=20000 \
	npm_config_fetch_retry_maxtimeout=120000 \
	npm_config_network_timeout=600000

# Cache npm downloads between builds (requires BuildKit, enabled by default in Docker Desktop)
RUN --mount=type=cache,target=/root/.npm \
	npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build

# runtime stage
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
COPY package*.json ./
ENV \
	npm_config_fetch_retries=5 \
	npm_config_fetch_retry_mintimeout=20000 \
	npm_config_fetch_retry_maxtimeout=120000 \
	npm_config_network_timeout=600000

RUN --mount=type=cache,target=/root/.npm \
	npm ci --omit=dev --no-audit --no-fund
COPY --from=builder /usr/src/app/dist ./dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
