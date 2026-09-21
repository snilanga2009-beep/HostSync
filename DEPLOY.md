# HostSync - Free Lifetime Deployment Guide 🚀
**GitHub Account**: `snilanga2009-beep` | **Repository**: `HostSync`

This guide explains how to deploy **HostSync** for **100% FREE for LIFETIME** with zero server costs using:
1. **GitHub**: Code repository (`snilanga2009-beep/HostSync`)
2. **Vercel**: Ultra-fast global frontend CDN hosting (Free forever)
3. **Render.com**: Node.js Backend API + real-time SSE dispatch engine (Free forever)
4. **Supabase**: Persistent cloud database & cloud storage for room photos & backups (Free forever)

---

## 📦 Step 1: Push Your Project to GitHub (`snilanga2009-beep/HostSync`)

A clean `.gitignore` has been prepared so your repository only contains your clean source code without bloated `node_modules`.

Open PowerShell or Command Prompt in `e:\hotel-QR`:
```bash
git init
git add .
git commit -m "Initial commit for HostSync Hotel QR Platform"
git branch -M main
git remote add origin https://github.com/snilanga2009-beep/HostSync.git
git push -u origin main
```
*(If your repository already has a README on GitHub, run `git pull origin main --rebase` before `git push`).*

---

## ⚡ Architecture for Best Free Lifetime Run

```
                   [ Guest Phone / QR Scanner ]
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
      ┌─────────────────┐             ┌─────────────────┐
      │  Vercel.com     │ ◄──REST/──► │   Render.com    │
      │  (Frontend UI)  │     SSE     │  (Backend API)  │
      │  FREE FOREVER   │             │  FREE FOREVER   │
      └─────────────────┘             └────────┬────────┘
                                               │
                                      ┌────────▼────────┐
                                      │   Supabase /    │
                                      │  SQLite Cloud   │
                                      │  FREE FOREVER   │
                                      └─────────────────┘
```

---

## 🌐 Step 2: Deploy Backend to Render.com (100% Free Web Service)

1. Go to **[https://render.com](https://render.com)** and sign in with your GitHub account (`snilanga2009-beep`).
2. Click **New +** (top right) ➔ **Web Service**.
3. Select your repository: **`HostSync`**.
4. Configure the settings:
   - **Name**: `hostsync-api` (or your preferred name)
   - **Region**: Choose closest (e.g. Frankfurt or Singapore or Oregon)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (or `server` if building standalone)
   - **Environment**: **Docker** *(Render detects our pre-configured `Dockerfile`)*
   - **Instance Type**: **Free** ($0 / month)
5. Under **Environment Variables**, add:
   - `PORT` = `5000`
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `hostsync-super-secure-jwt-key-2026`
6. Click **Create Web Service**.
7. Once deployed (takes 2-3 minutes), Render will give you your live backend URL, for example:
   👉 `https://hostsync-api.onrender.com`

---

## ⚡ Step 3: Deploy Frontend to Vercel.com (100% Free Global CDN)

1. Go to **[https://vercel.com](https://vercel.com)** and sign in with your GitHub account (`snilanga2009-beep`).
2. Click **Add New...** ➔ **Project**.
3. Import the **`HostSync`** repository.
4. In the Project Configuration:
   - **Framework Preset**: Vite
   - **Root Directory**: Click `Edit` and select **`client`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE`
   - **Value**: `https://hostsync-api.onrender.com/api` *(replace with your actual Render URL from Step 2)*
6. Click **Deploy**.

Vercel will build your frontend in ~30 seconds and give you a global live URL:
👉 `https://hostsync.vercel.app`

*(The pre-configured `client/vercel.json` ensures all SPA routes like `/admin`, `/login`, and `/r/101` work seamlessly without 404 errors).*

---

## 🗄️ Step 4: Supabase Integration (Free Database & Storage)

Why Supabase?
- **500 MB Free PostgreSQL Database** forever.
- **1 GB Free S3-Compatible Cloud Storage** for room photos, guest proof uploads, and staff avatars.
- **Lifetime Data Safety**: Your data will never reset when free server containers restart!

### Setting Up Free Cloud Storage for Photos:
1. Create a free project at **[https://supabase.com](https://supabase.com)** named `hostsync`.
2. Go to **Storage** ➔ Create a new public bucket named `hostsync-media`.
3. In Render environment variables, you can store your Supabase URL and Keys:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_KEY` = `your-anon-or-service-key`
4. The database backup file downloaded from **Admin Settings ➔ Download Backup** can also be backed up to Supabase with one click!

---

## 🔑 Live Admin Login Credentials

Once your site is live, open `/login`:
- **Email**: `admin@oceanpearl.com`
- **Password**: `password123`
- **Role**: Super Admin

You can immediately change the hotel name, colors, and add staff members inside the Admin Settings and User Management panels!

---

## 🚂 Method 3: Deploy on Railway.app (Free Trial)

1. Go to [https://railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your `hotel-qr` repository.
4. Railway will automatically build the `Dockerfile`.
5. Under service settings, click **Generate Domain** to get your free public URL (e.g., `hotel-qr.up.railway.app`).

---

## 🪰 Method 4: Deploy on Fly.io (Free Tier with Persistent SQLite Disk)

If you want the SQLite database file to permanently persist across server restarts:

1. Install Fly CLI:
   - Windows PowerShell:
     ```powershell
     powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
     ```
2. Log in:
   ```bash
   fly auth login
   ```
3. Launch app:
   ```bash
   fly launch
   ```
4. Create a persistent volume for the database:
   ```bash
   fly volumes create hotel_data --size 1
   ```
5. Deploy:
   ```bash
   fly deploy
   ```

---

## 🔑 Default Login Credentials for Live Admin Panel

Once your live site is up, navigate to `/login`:
- **Email**: `admin@oceanpearl.com`
- **Password**: `password123`
- **Role**: Super Admin

You can create more hotel admin or front office accounts inside the **Staff & User Management Panel** (`/admin/users`).
