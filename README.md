# BEER MAP

A shared beer spot map built with Next.js, Google Maps, Prisma, Supabase Postgres, and Google sign-in.

## What it does

- Search places by name with Google Places
- Save beer spots on a shared map
- Sign in with Google
- Use the signed-in Google name automatically when creating a pin
- Let users delete only the pins they created

## Environments

Use separate database targets for development and production:

- Development: local SQLite at `prisma/dev.db`.
- Production: Supabase Postgres used by Vercel.

The app reads environment variables from:

- Local development: `.env`
- Production deployment: Vercel Project Settings -> Environment Variables

Keep real `.env*` files private. Commit only `*.example` files.

## Local setup

### 1. Move into the project folder

```powershell
cd "C:\Users\naman\Beermap"
```

### 2. Create local `.env`

```powershell
Copy-Item .env.development.example .env
```

Add local development values to `.env`.

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_DEV_GOOGLE_MAPS_API_KEY"
GOOGLE_CLIENT_ID="YOUR_DEV_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_DEV_GOOGLE_CLIENT_SECRET"
AUTH_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
AUTH_URL="http://localhost:3000"
```

### 3. Google Cloud setup

Enable:

- Maps JavaScript API
- Places API

Create a Google OAuth client for a web app and add:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

For deployment, also add your production domain:

- Authorized JavaScript origin: `https://YOUR_DOMAIN`
- Authorized redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google`

If you use separate Google OAuth clients for development and production, put the
development client values in local `.env` and the production client values in Vercel.

### 4. Install packages

```powershell
npm.cmd install
```

### 5. Update local Prisma client and database

Local development uses `prisma/schema.local.prisma` and SQLite. It uses
`prisma db push` so local SQLite schema changes do not mix with the production
Postgres migration history.

```powershell
npm.cmd run prisma:generate:local
npm.cmd run prisma:migrate:local
```

### 6. Start the local app

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`.

## Production Supabase setup

Create a Supabase project, then open the SQL Editor and create a Prisma database user.

```sql
create user "prisma" with password 'custom_password' bypassrls createdb;
grant "prisma" to "postgres";
grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;
alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

In the Supabase dashboard, click **Connect** and copy:

- Transaction pooler URL for `DATABASE_URL` in deployed/serverless environments. It uses port `6543`.
- Session pooler URL for `DIRECT_URL` and Prisma migrations. It uses port `5432`.

Replace `YOUR_PROD_PRISMA_PASSWORD` with the password from the SQL above.

## Notes

- Local development uses SQLite through `prisma/schema.local.prisma`.
- Production uses Supabase Postgres through `prisma/schema.prisma`.
- Use `.env.development.example` and `.env.production.example` as templates.
- Keep `.env`, `.env.local`, `.env.development`, and `.env.production` private.
- The Google API key and OAuth secret shown in chat should be rotated before real deployment if they were exposed publicly.

## Production deployment

In Vercel, add the values from `.env.production.example` as Production environment variables:

```env
DATABASE_URL="postgresql://prisma.PROD_PROJECT_REF:YOUR_PROD_PRISMA_PASSWORD@PROD_POOLER_HOST:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://prisma.PROD_PROJECT_REF:YOUR_PROD_PRISMA_PASSWORD@PROD_POOLER_HOST:5432/postgres"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_PROD_GOOGLE_MAPS_API_KEY"
GOOGLE_CLIENT_ID="YOUR_PROD_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_PROD_GOOGLE_CLIENT_SECRET"
AUTH_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
AUTH_URL="https://YOUR_PRODUCTION_DOMAIN"
```

Use this Vercel build command:

```powershell
npx.cmd prisma generate && npx.cmd prisma migrate deploy && next build
```

For production migrations from your local machine, use the production Supabase
environment variables and the default Prisma schema:

```powershell
npm.cmd run prisma:deploy
```
