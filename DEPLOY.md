# Deployment Runbook: Railway + Vercel

This document outlines the step-by-step procedure for deploying the **Telemetric ReAct Engine** stack to production environments.

---

## Architecture Diagram

```
+------------------+                   +------------------+
|    React UI      | <===============> |   FastAPI API    |
|   (on Vercel)    |    HTTPS/REST     |   (on Railway)   |
+------------------+                   +------------------+
```

---

## Step 1: Deploy Backend to Railway

Railway detects Python applications using Nixpacks, which is pre-configured via `agent_project/Procfile` and `agent_project/runtime.txt`.

### Deployment Steps
1. Push your latest code changes to your GitHub repository (e.g. `main` branch).
2. Log in to the [Railway Console](https://railway.app).
3. Click **New Project** -> **Deploy from GitHub repo** and select `Autonomous-AI-Agent`.
4. In the configuration popup:
   * Set **Root Directory** to `agent_project` (this is critical so Railway finds `api.py` and `requirements.txt`).
5. Open the newly created service settings on Railway, navigate to the **Variables** tab, and add the following keys:
   ```env
   GROQ_API_KEY="your_groq_api_key"
   TAVILY_API_KEY="your_tavily_api_key"
   GROQ_MODEL="llama-3.3-70b-versatile"
   ```
6. Open the **Settings** tab, scroll to the **Networking** section, and click **Generate Domain** (or set a custom domain). 
7. Copy the public Railway URL (e.g., `https://agent-backend-production.up.railway.app`).

---

## Step 2: Deploy Frontend to Vercel

Vercel automatically detects the Vite React application. SPA redirects are pre-configured inside `agent_UI/vercel.json`.

### Deployment Steps
1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New** -> **Project** and import your `Autonomous-AI-Agent` GitHub repository.
3. In the project configuration:
   * Set **Framework Preset** to `Vite`.
   * Set **Root Directory** to `agent_UI`.
   * Expand the **Environment Variables** section and add:
     * Key: `VITE_API_URL`
     * Value: `https://your-backend.up.railway.app` *(The Railway public URL copied in Step 1)*
4. Click **Deploy**.
5. Once complete, Vercel will provide your public frontend URL (e.g., `https://autonomous-agent-ui.vercel.app`).

---

## Step 3: Verify Your Deployments

### 1. Backend Health Check
Open a terminal and trigger a health check against your live Railway service:
```bash
curl https://your-backend.up.railway.app/api/health
```
**Expected Response**:
```json
{
  "status": "ok",
  "model": "llama-3.3-70b-versatile",
  "tools": ["calculator", "file_reader", "web_search"]
}
```

### 2. Frontend Chat Check
1. Navigate to your Vercel frontend URL in the browser.
2. Verify the status dot in the header is **green** and shows `online`.
3. Send a test message, e.g. `what is 144 * 7?`.
4. Verify that:
   - The reasoning trace overlay opens on desktop showing the `🔢 Calculator` pill.
   - The final answer resolves correctly.
