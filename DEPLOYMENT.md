# Deploying WordOff to Production

The easiest way to deploy this full-stack Next.js + Socket.IO application is using **Railway** (railway.app) or **Render** (render.com). These platforms can host the entire app (frontend + backend) in a single service.

## Option 1: Railway (Recommended)

1.  **Push your code to GitHub.**
    -   Make sure this current codebase is pushed to a GitHub repository.

2.  **Sign up for Railway.app** and click **New Project**.

3.  **Select "Deploy from GitHub repo"** and choose your repository.

4.  **Configure the Service:**
    -   Railway will automatically detect the `package.json`.
    -   Go to **Settings** > **Build & Deploy**.
    -   **Start Command:** Set this to:
        ```bash
        npm run start:prod
        ```
        *(This runs your custom `server/index.ts` which serves both the website and the game sockets).*

5.  **Environment Variables:**
    -   Go to the **Variables** tab.
    -   Add `NEXT_PUBLIC_SOCKET_URL`: Set this to your Railway domain (e.g., `https://wordoff-production.up.railway.app`).
        -   *Note: Since the server handles both, the URL is just your main domain.*
    -   Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project settings.

6.  **Deploy!**
    -   Railway will build your app and start the server.
    -   Once deployed, open the URL provided by Railway.

## Option 2: Render (Has Free Tier)

Render offers a **Free** instance type for Web Services.
*Limitation: It "spins down" (sleeps) after 15 minutes of inactivity. When a new user joins, it might take 50 seconds to wake up.*

1.  Create a new **Web Service** on Render.
2.  Connect your GitHub repo.
3.  **Instance Type:** Select "Free".
4.  **Build Command:** `npm install && npm run build`
5.  **Start Command:** `npm run start:prod`
6.  **Environment Variables:**
    -   `NEXT_PUBLIC_SOCKET_URL`: Your Render URL (e.g., `https://wordoff.onrender.com`)
    -   `SUPABASE_URL` & `SUPABASE_ANON_KEY`.

## Option 3: Split Hosting (Vercel + Render)

**Best for:** Free Tier usage. Vercel hosts the site (Frontend), Render hosts the game server (Backend).

### Part A: Backend (Render)
1.  Create a new **Web Service** on Render.
2.  Connect your GitHub repo.
3.  **Instance Type:** "Free".
4.  **Build Command:** `npm install`
5.  **Start Command:** `npm run start:glitch`
    *   *Note: This runs the lightweight standalone server (`server/standalone.ts`) specifically for this backend-only role.*
6.  **Environment Variables:**
    -   `PORT`: `10000` (Render default)
    -   `SUPABASE_URL` & `SUPABASE_ANON_KEY`

### Part B: Frontend (Vercel)
1.  Import your GitHub repo to Vercel.
2.  Vercel will auto-detect Next.js settings.
3.  **Environment Variables:**
    -   `NEXT_PUBLIC_SOCKET_URL`: Your Render URL (e.g., `https://word-off.onrender.com`)
    -   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL
    -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Key
4.  **Deploy.**

### Special Note on Render Free Tier
The Render server will "sleep" after 15 minutes of inactivity. The first time you connect after a break, it may take ~50 seconds to wake up. This is normal for the free tier.

## Local Testing

To test the "production" setup locally:

1.  Build the Next.js app:
    ```bash
    npm run build
    ```
2.  Start the production server:
    ```bash
    npm run start:prod
    ```
3.  Open `http://localhost:3000`. The game should work fully (including multiplayer) on this single port.
