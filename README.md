# BEER MAP

A shared beer spot map built with Next.js, Google Maps, Prisma, and Google sign-in.

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
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
AUTH_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
```

### 3. Google Cloud setup

Enable:

- Maps JavaScript API
- Places API

Create a Google OAuth client for a web app and add:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### 4. Install packages

```powershell
npm.cmd install
```

### 5. Update Prisma client and database

Because the schema now includes login ownership fields, run:

```powershell
npx.cmd prisma generate
npx.cmd prisma migrate dev --name add-google-auth-owner
```

### 6. Start the app

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`.

## Notes

- This project currently uses SQLite for local development.
- For shared deployment, switch to Postgres before publishing.
- The Google API key and OAuth secret shown in chat should be rotated before real deployment if they were exposed publicly.
