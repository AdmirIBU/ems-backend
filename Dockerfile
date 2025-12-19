# build stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
ENV NODE_ENV=development
RUN npm ci
COPY . .
RUN npm run build

# runtime stage
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /usr/src/app/dist ./dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
