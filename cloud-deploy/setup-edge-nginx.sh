#!/usr/bin/env bash
# Install edge nginx (443) for guildmaster*.duckdns.org + Let's Encrypt
# phpMyAdmin stays on host :8080 for direct IP access (not behind DuckDNS).
# Run on Clouding as root. Requires: Docker, ports 80+443 free/open, DNS already pointing here.
set -euo pipefail

CERT_NAME=guildmaster.duckdns.org
DOMAINS=(-d guildmaster.duckdns.org -d guildmasterapi.duckdns.org -d guildmasteradmin.duckdns.org)
WEB_DIR=/root/guildmaster-web
EDGE_DIR=/root/gm-edge
CONF_SRC="${1:-/root/nginx-edge.conf}"

if [[ ! -f "$CONF_SRC" ]]; then
  echo "Missing nginx config: $CONF_SRC"
  echo "Usage: $0 /root/nginx-edge.conf"
  exit 1
fi

if [[ ! -d "$WEB_DIR" ]]; then
  echo "Missing web files at $WEB_DIR — deploy the Expo static build first."
  exit 1
fi

echo "==> Ensuring phpMyAdmin on 0.0.0.0:8080 (direct IP access)…"
docker rm -f phpmyadmin 2>/dev/null || true
docker run -d \
  --name phpmyadmin \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -e PMA_HOST=host.docker.internal \
  -e PMA_PORT=3306 \
  -p 8080:80 \
  phpmyadmin:latest

echo "==> Stopping old public proxies (443/8443/8444) — keep phpmyadmin…"
docker rm -f pma-proxy api-proxy web-proxy gm-edge 2>/dev/null || true

mkdir -p "$EDGE_DIR/certbot" /var/www/certbot
cp "$CONF_SRC" "$EDGE_DIR/nginx-edge.conf"

echo "==> Obtaining / renewing Let's Encrypt cert (standalone on :80)…"
docker run --rm \
  -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/certbot certonly --standalone \
  --cert-name "$CERT_NAME" \
  "${DOMAINS[@]}" \
  --agree-tos --register-unsafely-without-email --non-interactive \
  --preferred-challenges http \
  --expand

echo "==> Starting edge nginx on 80+443…"
docker run -d \
  --name gm-edge \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 80:80 \
  -p 443:443 \
  -v "$EDGE_DIR/nginx-edge.conf":/etc/nginx/conf.d/default.conf:ro \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -v "$WEB_DIR":/usr/share/nginx/html:ro \
  -v /var/www/certbot:/var/www/certbot:ro \
  nginx:alpine

sleep 2
docker ps --filter name=gm-edge --filter name=phpmyadmin
echo
echo "Smoke tests:"
curl -sI "https://guildmaster.duckdns.org/" | head -n 5 || true
curl -s "https://guildmasterapi.duckdns.org/actuator/health" || true
echo
curl -sI "https://guildmasteradmin.duckdns.org/login.html" | head -n 5 || true
curl -sI "http://127.0.0.1:8080/" | head -n 5 || true
echo
echo "Done."
echo "phpMyAdmin (IP): http://SERVER_IP:8080/  — open Clouding port 8080"
echo "DuckDNS apps stay on :443 only."
