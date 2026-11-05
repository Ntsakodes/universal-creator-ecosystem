FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY . .
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

FROM build AS api
ENV NODE_ENV=production API_BIND_ADDRESS=0.0.0.0
USER node
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@uce/api"]

FROM build AS worker
ENV NODE_ENV=production
USER node
CMD ["node", "apps/api/dist/apps/api/src/worker.js"]

FROM build AS web
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@uce/web"]
