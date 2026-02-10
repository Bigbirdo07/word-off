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

## Option 2: Render

1.  Create a new **Web Service** on Render connected to your GitHub repo.
2.  **Build Command:** `npm install && npm run build`
3.  **Start Command:** `npm run start:prod`
4.  **Environment Variables:**
    -   `NEXT_PUBLIC_SOCKET_URL`: Your Render URL (e.g., `https://wordoff.onrender.com`)
    -   `SUPABASE_URL` & `SUPABASE_ANON_KEY`.

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
