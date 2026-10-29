# ---------- Stage 1: build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
# Generate the Prisma client into node_modules/.prisma
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build
# Drop dev dependencies but keep the generated Prisma client
RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
# nest build outputs to dist/src because tsconfig rootDir is "./"
CMD ["node", "dist/src/main.js"]
