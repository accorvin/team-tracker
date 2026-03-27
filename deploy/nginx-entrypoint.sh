#!/bin/sh
# Substitute PROXY_AUTH_SECRET into nginx config template, then start nginx.
# CRITICAL: scope envsubst to only $PROXY_AUTH_SECRET to avoid clobbering
# nginx variables like $host, $uri, $remote_addr, etc.
envsubst '$PROXY_AUTH_SECRET' < /opt/app-root/etc/nginx.default.d/app.conf.template \
  > /opt/app-root/etc/nginx.default.d/app.conf

exec /usr/libexec/s2i/run
