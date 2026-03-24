# Stage 1: Build the Vue SPA
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.mjs tailwind.config.mjs postcss.config.mjs ./
COPY src/ ./src/
COPY public/ ./public/
COPY shared/client/ ./shared/client/
COPY modules/ ./modules/

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# OpenShift compatibility: make writable for non-root
RUN chown -R 1001:0 /usr/share/nginx/html && \
    chmod -R g+rwX /usr/share/nginx/html && \
    chown -R 1001:0 /var/cache/nginx && \
    chmod -R g+rwX /var/cache/nginx && \
    chown -R 1001:0 /var/log/nginx && \
    chmod -R g+rwX /var/log/nginx && \
    chown -R 1001:0 /etc/nginx/conf.d && \
    chmod -R g+rwX /etc/nginx/conf.d && \
    # nginx needs to write pid file
    touch /var/run/nginx.pid && \
    chown 1001:0 /var/run/nginx.pid && \
    chmod g+rw /var/run/nginx.pid

USER 1001

EXPOSE 8080
