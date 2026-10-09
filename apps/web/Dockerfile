# Production image for the gov web app: build with Vite, serve with nginx (strict CSP, see nginx/).
# Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=/ -t nyaysetu-gov-web .
# VITE_API_URL=/ means "call /api on this same site" (nginx forwards it to the API, see nginx/default.conf.template).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace apps/web --include-workspace-root
COPY apps/web apps/web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
# Defaults suit docker compose. On Railway set API_UPSTREAM to the gov API's private address (see RAILWAY_DEPLOY_GOV.md).
ENV API_UPSTREAM=http://gov-api:8081
ENV NGINX_RESOLVER=127.0.0.11
# The Content-Security-Policy lets the browser call this site itself ('self', which includes the /api proxy above).
# Only if the browser must call a DIFFERENT address, build with --build-arg API_ORIGIN=https://that-address
ARG API_ORIGIN="'self'"
ENV API_ORIGIN=$API_ORIGIN
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/web/nginx/security-headers.inc /etc/nginx/templates/security-headers.inc.template
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
