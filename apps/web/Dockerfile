# Production image for the gov web app: build with Vite, serve with nginx (strict CSP, see nginx/).
# Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.gov.example.org -t nyaysetu-gov-web .
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
ARG VITE_API_URL
# the Content-Security-Policy allows the browser to call exactly this API address
ENV API_ORIGIN=$VITE_API_URL
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/web/nginx/security-headers.inc /etc/nginx/templates/security-headers.inc.template
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
