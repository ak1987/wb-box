# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Build everything
RUN npm run build

# Compile knexfile to JavaScript
RUN npx tsc knexfile.ts --module commonjs --esModuleInterop

# Compile migrations to dist folder
RUN npx tsc src/database/migrations/*.ts --outDir dist/database/migrations --module commonjs --esModuleInterop

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

# Copy built app and knexfile.js
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/knexfile.js ./

EXPOSE ${HTTP_PORT:-3000}

# Run migrations and start app
CMD npx knex migrate:latest --knexfile knexfile.js && npm run start:prod
