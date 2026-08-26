# appMovilGuildMaster

## Web development

Install dependencies, configure the API URL, and start Expo Web:

```bash
npm ci
cp .env.example .env.local
npm run web
```

The API URL is set with `EXPO_PUBLIC_API_BASE_URL` in `.env.local`
(copy from `.env.example`). Production default:

`https://guildmasterapi.duckdns.org/api`

For a local API: `http://localhost:8081/api` (Android emulator: `http://10.0.2.2:8081/api`).

Build a static web bundle with:

```bash
npm run web:export
```

Run the TypeScript check with:

```bash
npm run typecheck
```

Do not commit `.env.local`.
