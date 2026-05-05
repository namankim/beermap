# BEER MAP

A shared beer spot map built with Next.js, Google Maps, Prisma, Supabase Postgres, and Google sign-in.

## What it does

- Search places by name with Google Places
- Save beer spots on a shared map
- Sign in with Google
- Use the signed-in Google name automatically when creating a pin
- Let users delete only the pins they created

## Local setup

### 1. Move into the project folder

```powershell
cd "C:\Users\naman\Beermap"
```

### 2. Create `.env`

```powershell
Copy-Item .env.example .env
```

Add these values to `.env`.

```env
DATABASE_URL="postgresql://prisma.kflobjojdfsaazxuybxr:YOUR_PRISMA_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://prisma.kflobjojdfsaazxuybxr:YOUR_PRISMA_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
AUTH_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
AUTH_URL="http://localhost:3000"
```

### 3. Supabase setup

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

This project's visible Supabase reference is `kflobjojdfsaazxuybxr`, and the database region is `ap-southeast-1`.
Replace `YOUR_PRISMA_PASSWORD` with the password from the SQL above.

### 4. Google Cloud setup

Enable:

- Maps JavaScript API
- Places API

Create a Google OAuth client for a web app and add:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

For deployment, also add your production domain:

- Authorized JavaScript origin: `https://YOUR_DOMAIN`
- Authorized redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google`

### 5. Install packages

```powershell
npm.cmd install
```

### 6. Update Prisma client and database

Run the Postgres migration against Supabase:

```powershell
npx.cmd prisma generate
npx.cmd prisma migrate dev
```

For production deployments, apply already-created migrations with:

```powershell
npx.cmd prisma migrate deploy
```

### 7. Start the app

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`.

## Notes

- This project uses Supabase Postgres through Prisma.
- Keep `.env` private. Commit `.env.example`, not `.env`.
- The Google API key and OAuth secret shown in chat should be rotated before real deployment if they were exposed publicly.
