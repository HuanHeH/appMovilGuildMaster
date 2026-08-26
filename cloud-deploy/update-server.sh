#!/usr/bin/env bash
# Refresh all GuildMaster pieces on the Clouding server (run as root).
set -euo pipefail

echo "==> 1) Web static build from GitHub…"
cd /root
curl -L -o guildmaster-web-dist.tar.gz \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/guildmaster-web-dist.tar.gz
curl -L -o deploy-web-on-server.sh \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/deploy-web-on-server.sh
chmod +x deploy-web-on-server.sh
# Unpack only (do not recreate old :8444 proxy if edge nginx is already up)
mkdir -p /root/guildmaster-web
rm -rf /root/guildmaster-web/*
tar -xzf /root/guildmaster-web-dist.tar.gz -C /root/guildmaster-web

echo "==> 2) Edge nginx config + phpMyAdmin on :8080…"
curl -L -o nginx-edge.conf \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/nginx-edge.conf
curl -L -o setup-edge-nginx.sh \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/setup-edge-nginx.sh
chmod +x setup-edge-nginx.sh
bash setup-edge-nginx.sh /root/nginx-edge.conf

echo "==> 3) Ensure API CORS + restart…"
# Does not rewrite secrets; only reminds if CORS line missing.
if ! systemctl cat guildmaster-api 2>/dev/null | grep -q 'guildmaster.duckdns.org'; then
  echo "WARNING: add CORS_ALLOWED_ORIGINS with DuckDNS hosts to guildmaster-api.service, then:"
  echo "  systemctl daemon-reload && systemctl restart guildmaster-api"
else
  systemctl restart guildmaster-api
fi

echo "==> 4) Smoke…"
curl -sI https://guildmaster.duckdns.org/ | head -n 3 || true
curl -s https://guildmasterapi.duckdns.org/actuator/health || true
echo
curl -sI https://guildmasteradmin.duckdns.org/login.html | head -n 3 || true
curl -sI http://127.0.0.1:8080/ | head -n 3 || true
echo
echo "Done. Soft-refresh the browser (Ctrl+F5)."
