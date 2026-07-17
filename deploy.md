# 🚀 Pixel Kitchen Sim Deployment & Local Testing Guide

This guide details how to run, test, and validate all features locally (including serverless Netlify Functions and database operations) before pushing the final version to production on Netlify.

---

## 💻 1. Local Testing Workflow

To test the entire stack locally (Vite frontend + Netlify Serverless Functions), you should run the local development server through the **Netlify CLI**. This automatically handles function execution and proxies API calls correctly.

### Step 1: Install Dependencies
Ensure all packages are installed:
```bash
npm install
```

### Step 2: Configure Local Environment Variables
Create a file named `.env` in the root of your project directory (`kitchen-sim-final/`) and add your Supabase credentials:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```
> [!NOTE]
> If you don't have a Supabase project created yet, see the **Supabase Setup** section below.

### Step 3: Start the Netlify Development Server
Run the following command in your terminal:
```bash
npx netlify dev
```
This will:
1. Spin up the Vite development server (usually on port `5173`).
2. Start the Netlify Serverless Functions emulator.
3. Open a gateway at **`http://localhost:8888`** that proxies all traffic.

Open **`http://localhost:8888`** in your browser to play and test the full game with active leaderboard & levels database functionality.

> [!WARNING]
> **Static Server Gotcha (`npx serve`)**:
> Running `npx serve` directly on the project root will fail with `Uncaught TypeError: Failed to resolve module specifier "three"`. This is because standard static servers do not compile ESM imports or map resolve aliases.
> To test the compiled bundle locally:
> 1. Run `npm run build` to build the game into the `dist/` directory.
> 2. Serve the compiled `dist/` directory using: `npx serve dist` or `npm run preview`.

---

## 🛠️ 2. Supabase Database Setup

Before deploying, your Supabase PostgreSQL instance needs to have the correct tables and policies.

1. Go to the [Supabase Dashboard](https://supabase.com) and create a new project.
2. In your Supabase project, navigate to the **SQL Editor** in the left sidebar.
3. Click **New query**, paste the contents of [supabase/schema.sql](file:///Volumes/MacintoshSSD/azzxl/Projects/Azzxl.com/Game/kitchen-sim-final/supabase/schema.sql) into the editor.
4. Click **Run** to create the tables (`leaderboard`, `custom_levels`) and set up Row Level Security (RLS).

---

## 🚀 3. Production Netlify Deployment

You can deploy the game using either the **Netlify Git Integration** (recommended) or the **Netlify CLI**.

### Option A: Via Git Integration (Recommended)
If your repository is hosted on GitHub, GitLab, or Bitbucket, you can set up automatic builds:

1. Log in to the [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Link your Git repository.
4. Configure the Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Add environment variables** under the site configuration, and add:
   - `SUPABASE_URL`: (Your Supabase Project URL)
   - `SUPABASE_ANON_KEY`: (Your Supabase API Key)
6. Click **Deploy site**. Netlify will automatically build and deploy the game whenever you push to your main branch!

### Option B: Via Netlify CLI
If you want to deploy directly from your local command line:

1. Initialize and link your local directory to a Netlify site:
   ```bash
   npx netlify init
   ```
2. Set your environment variables on the Netlify site:
   ```bash
   npx netlify env:set SUPABASE_URL "https://your-project-id.supabase.co"
   npx netlify env:set SUPABASE_ANON_KEY "your-supabase-anon-key"
   ```
3. Run a production build and deploy to production:
   ```bash
   npm run build
   npx netlify deploy --prod
   ```

---

## 🔍 4. Pre-Push Verification Checklist

Verify the following items are working correctly on your local port `8888` server before triggering a production build:

- [ ] **Player Physics**: Confirm that walking into tables or counter corners halts the player cleanly without getting stuck.
- [ ] **Volume Settings**: Move the Master Volume slider and verify that sound effects (e.g. chop/ding) adjust their volume accordingly.
- [ ] **Mouse Sensitivity**: Adjust the sensitivity slider and confirm that camera rotation changes speed.
- [ ] **Smoothie Ingredients**: Start Level 4, place yogurt/milk + fruit into the blender, and verify you can pour a valid smoothie.
- [ ] **Leaderboard Submissions**: Complete a level, choose a nickname, and verify your score registers on the leaderboard tab.
- [ ] **Custom Levels Sharing**: Go to the Level Editor, save a custom level, and click the share icon (🌐) to retrieve a valid Share Code.
