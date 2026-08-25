FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
# Fail the build on a bad dependency tree rather than carrying on with an
# incomplete node_modules — `|| true` turned install errors into confusing
# "module not found" failures later in the build.
RUN npm install --legacy-peer-deps

COPY . .

RUN mkdir -p public

# Next.js inlines NEXT_PUBLIC_* values at build time, so the gateway URL has to
# be present here, not only at runtime.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -fsS http://localhost:3000 || exit 1

CMD ["npm", "start"]
