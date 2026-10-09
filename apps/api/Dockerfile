FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace apps/api --include-workspace-root
COPY apps/api apps/api
COPY data data
RUN npm run build -w apps/api && npm prune --omit=dev --workspace apps/api

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/sql ./apps/api/sql
COPY --from=build /app/data ./data
WORKDIR /app/apps/api
USER node
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:8081/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
