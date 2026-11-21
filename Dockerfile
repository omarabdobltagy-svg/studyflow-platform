FROM node:22-bookworm-slim
WORKDIR /app
COPY studyflow-source.tar /tmp/studyflow-source.tar
COPY overrides/ /tmp/overrides/
RUN tar -xf /tmp/studyflow-source.tar -C /app && \
    cp -a /tmp/overrides/. /app/ && \
    rm -rf /tmp/studyflow-source.tar /tmp/overrides && \
    if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    else npm install; fi && npm run build
ENV NODE_ENV=production
CMD ["npm","start"]
