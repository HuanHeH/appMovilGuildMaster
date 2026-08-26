#!/usr/bin/env bash
# Fix phpMyAdmin only (502 on https://IP/ ). Run as root.
set -euo pipefail

IP="${1:-187.33.148.249}"

echo "==> Recreate phpMyAdmin on 127.0.0.1:8080…"
docker rm -f phpmyadmin 2>/dev/null || true
docker run -d \
  --name phpmyadmin \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -e PMA_HOST=host.docker.internal \
  -e PMA_PORT=3306 \
  -e PMA_ABSOLUTE_URI="https://${IP}/" \
  -p 127.0.0.1:8080:80 \
  phpmyadmin:latest

echo "==> Wait for Apache inside phpMyAdmin…"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf -o /dev/null http://127.0.0.1:8080/; then
    echo "    phpMyAdmin local OK"
    break
  fi
  sleep 1
  if [[ $i -eq 10 ]]; then
    echo "FAILED: phpMyAdmin did not become ready on 127.0.0.1:8080"
    docker logs phpmyadmin --tail 40
    exit 1
  fi
done

echo "==> Ensure MariaDB reachable from host…"
docker exec mariadb mariadb -uroot -pmiPassword -e "SELECT 1;" >/dev/null 2>&1 \
  && echo "    mariadb OK" \
  || echo "WARNING: cannot login to mariadb with root/miPassword — fix DB password in this script"

echo "==> Recreate gm-edge with current nginx-edge.conf…"
if [[ ! -f /root/nginx-edge.conf ]]; then
  curl -L -o /root/nginx-edge.conf \
    https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/nginx-edge.conf
fi
mkdir -p /root/gm-edge /var/www/certbot /root/guildmaster-web
cp /root/nginx-edge.conf /root/gm-edge/nginx-edge.conf

docker rm -f gm-edge 2>/dev/null || true
docker run -d \
  --name gm-edge \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 80:80 \
  -p 443:443 \
  -p 8445:8445 \
  -v /root/gm-edge/nginx-edge.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -v /root/guildmaster-web:/usr/share/nginx/html:ro \
  -v /var/www/certbot:/var/www/certbot:ro \
  nginx:alpine

sleep 2
echo "==> Smoke from inside the server…"
curl -k -sI "https://127.0.0.1/" | head -n 8 || true
curl -k -sI "https://127.0.0.1:8445/" | head -n 8 || true
echo
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'NAMES|phpmyadmin|gm-edge|mariadb' || true
echo
echo "Open: https://${IP}/  or  https://${IP}:8445/"
echo "Accept the certificate warning (cert is for DuckDNS, not the IP)."
echo "Login: root / your MariaDB password"
echo "App web stays at: https://guildmaster.duckdns.org"
