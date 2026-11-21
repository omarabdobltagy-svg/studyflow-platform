FROM node:22-bookworm-slim
WORKDIR /app
COPY studyflow-source.tar /tmp/studyflow-source.tar
RUN tar -xf /tmp/studyflow-source.tar -C /app && rm /tmp/studyflow-source.tar && \
    if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    else npm install; fi && npm run build
ENV NODE_ENV=production
CMD ["npm","start"]
