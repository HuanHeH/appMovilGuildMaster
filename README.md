# appMovilGuildMaster

## Web development

Install dependencies, configure the API URL, and start Expo Web:

```bash
npm ci
cp .env.example .env.local
npm run web
```

The default API URL is `http://localhost:8081/api`. Override it in
`.env.local` with `EXPO_PUBLIC_API_BASE_URL` when the backend is elsewhere.

Build a static web bundle with:

```bash
npm run web:export
```

Run the TypeScript check with:

```bash
npm run typecheck
```

Do not commit `.env.local`.
