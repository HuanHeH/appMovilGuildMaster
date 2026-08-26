# Clouding deploy (DuckDNS + edge nginx)

## Hostnames

| Host | Service |
|------|---------|
| `https://guildmaster.duckdns.org` | Expo web (`/root/guildmaster-web`) |
| `https://guildmasterapi.duckdns.org` | Spring API |
| `https://guildmasteradmin.duckdns.org` | API Admin UI (`login.html`) |
| `http://SERVER_IP:8080` | phpMyAdmin (direct IP, no DuckDNS) |

All on port **443** (HTTP 80 redirects to HTTPS).

## 1) Static web files

```bash
cd /root
curl -L -o guildmaster-web-dist.tar.gz \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/guildmaster-web-dist.tar.gz
curl -L -o deploy-web-on-server.sh \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/deploy-web-on-server.sh
chmod +x deploy-web-on-server.sh
bash deploy-web-on-server.sh /root/guildmaster-web-dist.tar.gz
```

(`deploy-web-on-server.sh` still unpacks to `/root/guildmaster-web`; the old `:8444` proxy is replaced by edge nginx.)

## 2) Edge nginx + Let's Encrypt

In Clouding open **80** and **443**.

```bash
cd /root
curl -L -o nginx-edge.conf \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/nginx-edge.conf
curl -L -o setup-edge-nginx.sh \
  https://github.com/HuanHeH/appMovilGuildMaster/raw/main/cloud-deploy/setup-edge-nginx.sh
chmod +x setup-edge-nginx.sh
bash setup-edge-nginx.sh /root/nginx-edge.conf
```

## 3) API CORS (systemd)

```ini
Environment=CORS_ALLOWED_ORIGINS=https://guildmaster.duckdns.org,https://guildmasterapi.duckdns.org,https://guildmasteradmin.duckdns.org,http://localhost:8082
```

Then: `sudo systemctl daemon-reload && sudo systemctl restart guildmaster-api`

## Rebuild web locally

```bash
EXPO_PUBLIC_API_BASE_URL=https://guildmasterapi.duckdns.org/api npm run web:export
```

Then refresh `cloud-deploy/guildmaster-web-dist.tar.gz` and re-run step 1 (or copy `dist/` into `/root/guildmaster-web`).
