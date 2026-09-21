FROM node:20-alpine AS builder

# Install build dependencies for native better-sqlite3 compilation
RUN apk add --no-cache python3 make g++ gcc libc-dev

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all packages
RUN npm install --prefix server
RUN npm install --prefix client

# Copy source code
COPY . .

# Build frontend and backend
RUN npm run build --prefix client
RUN npm run build --prefix server

# Production runner
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 make g++ gcc libc-dev

ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/uploads ./uploads

EXPOSE 5000

CMD ["npm", "run", "start", "--prefix", "server"]
