FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY package*.json ./
RUN npm install --omit=dev

COPY --chown=app:app . .

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

USER app

CMD ["node", "src/server.js"]
