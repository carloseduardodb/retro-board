# Base Debian, não Alpine: o Chrome Headless Shell que o Remotion usa para
# renderizar o recap é compilado contra glibc e não roda em musl.
FROM node:22-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else npm i; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL=https://jjipzzlkmgzxoymwbafu.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaXB6emxrbWd6eG95bXdiYWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTA3ODMsImV4cCI6MjA5NTMyNjc4M30.kIUk6Q-C53UJ_UmoFgm2XrnLUyQM4cVuWGSUIiCbdv4

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Instalação isolada e completa do renderer.
#
# O `output: standalone` copia arquivo a arquivo, só o que o tracing enxerga
# estaticamente — e o renderer resolve parte das suas dependências em tempo de
# execução: o compositor nativo por plataforma e o `ws`. O que sobrava na imagem
# era um `@remotion/renderer` pela metade, que vencia a resolução e só quebrava
# na hora de renderizar. A versão sai do package.json do app, para não descolar.
FROM base AS renderer
WORKDIR /opt/remotion

COPY --from=builder /app/package.json ./app-package.json

# O `find` descarta os compositores das outras plataformas — 25MB cada de
# binário para sistemas que esta imagem nunca vai rodar. Em seguida o pacote é
# remontado com as dependências aninhadas dentro dele: assim o renderer resolve
# as suas, e nenhum outro pacote da árvore do standalone é tocado.
RUN REMOTION_VERSION="$(node -p "require('./app-package.json').dependencies['@remotion/renderer'].replace(/^\\D*/, '')")" \
  && npm install --no-package-lock --no-audit --no-fund --omit=dev "@remotion/renderer@${REMOTION_VERSION}" \
  && rm app-package.json \
  && find node_modules/@remotion -maxdepth 1 -name 'compositor-*' \
       ! -name 'compositor-linux-x64-gnu' -exec rm -rf {} + \
  && mkdir -p /out/@remotion/renderer \
  && cp -a node_modules/@remotion/renderer/. /out/@remotion/renderer/ \
  && mkdir -p /out/@remotion/renderer/node_modules \
  && cp -a node_modules/. /out/@remotion/renderer/node_modules/ \
  && rm -rf /out/@remotion/renderer/node_modules/@remotion/renderer \
  && npm cache clean --force

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Bibliotecas do Chrome headless e fontes. Sem `fonts-noto-color-emoji` os
# emojis dos votos e das reações sairiam como quadradinhos dentro do vídeo.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      fonts-noto-color-emoji \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libnss3 \
      libpango-1.0-0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs --home /home/nextjs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Composição já empacotada no build: o servidor nunca roda webpack, só renderiza.
COPY --from=builder --chown=nextjs:nodejs /app/.remotion-bundle ./.remotion-bundle

# Renderer completo por cima do que o tracing deixou pela metade (ver estágio
# `renderer`). Só este pacote é substituído; o resto da árvore fica como o
# standalone montou.
COPY --from=renderer --chown=nextjs:nodejs /out ./node_modules/

USER nextjs

# Baixa o Chrome Headless Shell na versão que este Remotion espera. O destino é
# `/app/node_modules/.remotion`, derivado do cwd — por isso roda já como o
# usuário do servidor, que é quem vai precisar ler o binário depois.
RUN node -e "require('@remotion/renderer').ensureBrowser()"

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
