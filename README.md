# appMovilGuildMaster

## Web development

Install dependencies, configure the API URL, and start Expo Web:

```bash
npm ci
cp .env.example .env.local
npm run web
```

The API URL is set with `EXPO_PUBLIC_API_BASE_URL` in `.env.local` (gitignored).

| Entorno | `.env.local` (tu máquina) | `.env.example` (repo / prod) |
|---------|---------------------------|------------------------------|
| **Local** | `http://localhost:8081/api` | — |
| **Producción** | — | `https://guildmasterapi.duckdns.org/api` |

```bash
cp .env.example .env.local
# Edit .env.local → EXPO_PUBLIC_API_BASE_URL=http://localhost:8081/api
```

Android emulator: keep `localhost` in `.env.local`; the app rewrites it to `10.0.2.2` automatically.

After changing `.env.local`, restart Expo (`npm run web`).

Build a static web bundle with:

```bash
npm run web:export
```

Run the TypeScript check with:

```bash
npm run typecheck
```

Do not commit `.env.local`.
