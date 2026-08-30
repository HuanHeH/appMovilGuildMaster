# appMovilGuildMaster

> **Créditos:** Este proyecto fue desarrollado como parte del **Summer of Code 2026 de Aircury SL**. Créditos de este proyecto y su correspondiente dotación de premio a **Aircury SL**.

## Web development

```bash
npm ci
cp .env.example .env.local
npm run web
```

**API URL:** `EXPO_PUBLIC_API_BASE_URL` in `.env.local` (gitignored). Committed `.env.example` = remote URL.

| Entorno | `.env.local` |
|---------|----------------|
| **Remoto (prod)** | `https://api.guildmasterweb.com` |
| **Local API** | `http://localhost:8081/api` (Android emulator → `10.0.2.2` automático) |

Restart Expo after changing `.env.local`.

```bash
npm run web:export
npm run typecheck
```
