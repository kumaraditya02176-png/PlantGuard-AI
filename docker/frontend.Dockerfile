FROM node:22.23.4-trixie-slim
WORKDIR /app

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@12.2.2 \
    && npm install --global pnpm@11.28.11 \
    && npm cache clean --force \
    && rm -rf /root/.npm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile \
    && pnpm store prune \
    && rm -rf /root/.cache/pnpm

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

EXPOSE 3000
CMD ["pnpm","start","--hostname","0.0.0.0"]
