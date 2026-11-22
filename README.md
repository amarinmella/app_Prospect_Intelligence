# Prospect Intelligence

Inteligencia comercial para Innova IA Studio: busca negocios por nicho y ubicación, los analiza, detecta oportunidades, prioriza y gestiona el contacto desde un dashboard.

## Arrancar

```bash
npm install
cp .env.example .env.local   # sin DATABASE_URL usa una base local (PGlite en .data/)
npm run dev
```

Producción: Vercel + Supabase. Define `DATABASE_URL`, `APP_PASSWORD` (obligatoria: sin ella la app responde 503) y ejecuta `npm run db:migrate` (o `AUTO_MIGRATE=true`).

## Arquitectura

- `supabase/migrations/` esquema SQL (RLS activado; la app accede solo desde el servidor).
- `lib/db` acceso a Postgres (Supabase o PGlite local, mismo esquema). `lib/repo` consultas por entidad.
- Módulos con contratos tipados (cada hilo toca solo el suyo): `lib/discovery`, `lib/analysis`, `lib/scoring`, `lib/outreach`, `lib/reports`. Cada `types.ts` es el contrato; `index.ts` es el punto de enganche.
- `lib/pipeline` orquesta descubrimiento → análisis → scoring → persistencia y devuelve bloqueos (falta de clave / módulo pendiente) sin romper la UI.
- `app/` UI en español: Dashboard, Empresas (filtros), Ficha, CRM, Búsquedas, Configuración.
- Fuentes de datos y variables: `docs/fuentes-de-datos.md`.

Sin datos ficticios: la app arranca vacía y los campos no disponibles se muestran como "no disponible".
