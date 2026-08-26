#!/usr/bin/env bash
# Deploy GuildMaster web static (run on Clouding server as root)
set -euo pipefail

WEB_DIR=/opt/guildmaster-web
SSL_DIR=/opt/phpmyadmin-ssl
ARCHIVE="${1:-/root/guildmaster-web-dist.tar.gz}"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Archive not found: $ARCHIVE"
  echo "Usage: $0 /path/to/guildmaster-web-dist.tar.gz"
  exit 1
fi

mkdir -p "$WEB_DIR" "$SSL_DIR"
rm -rf "${WEB_DIR:?}/"*
tar -xzf "$ARCHIVE" -C "$WEB_DIR"

tee "$SSL_DIR/web.conf" > /dev/null <<'EOF'
server {
    listen 8444 ssl;
    server_name _;

    ssl_certificate     /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

docker rm -f web-proxy 2>/dev/null || true

docker run -d \
  --name web-proxy \
  --restart unless-stopped \
  -p 8444:8444 \
  -v "$SSL_DIR":/etc/nginx/certs:ro \
  -v "$SSL_DIR/web.conf":/etc/nginx/conf.d/default.conf:ro \
  -v "$WEB_DIR":/usr/share/nginx/html:ro \
  nginx:alpine

echo "Waiting for nginx..."
sleep 2
curl -k -I https://127.0.0.1:8444/ || true
echo
echo "Done. Open https://SERVER_IP:8444/ and open Clouding port 8444."
