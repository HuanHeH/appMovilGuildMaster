# Clouding web deploy

Static Expo web build for the production server (API HTTPS `:8443`).

## On the server

```bash
cd /root
curl -L -o guildmaster-web-dist.tar.gz \
  https://raw.githubusercontent.com/HuanHeH/appMovilGuildMaster/main/cloud-deploy/guildmaster-web-dist.tar.gz
curl -L -o deploy-web-on-server.sh \
  https://raw.githubusercontent.com/HuanHeH/appMovilGuildMaster/main/cloud-deploy/deploy-web-on-server.sh
chmod +x deploy-web-on-server.sh
bash deploy-web-on-server.sh /root/guildmaster-web-dist.tar.gz
```

Files land in **`/root/guildmaster-web`**. Open Clouding port **8444**. App URL: `https://SERVER_IP:8444/`

Rebuild locally: `EXPO_PUBLIC_API_BASE_URL=https://SERVER:8443/api npm run web:export` then refresh the tarball in this folder.
