# Reicrew AI — Deployment Guide

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Supabase account (project required)
- Clerk account (authentication)
- OpenRouter API key (AI features)
- Vercel account (deployment)

---

## Environment Configuration

Create `.env.local` in the project root:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_key

# AI (OpenRouter)
VITE_OPENROUTER_API_KEY=sk-or-your_openrouter_key

# Admin Access
VITE_ADMIN_PASSWORD=your_admin_password
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Run tests
npm run test

# Type check
npm run typecheck

# CI check (typecheck + test)
npm run ci:check
```

---

## Build & Deploy

### Vercel (Recommended)

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

**Vercel Configuration** (`vercel.json`):
- SPA routing: All routes → `/index.html`
- Security headers: X-Frame-Options, CSP, HSTS
- Camera/microphone permissions enabled

### Docker

```bash
# Build and run with docker-compose
docker-compose up -d

# Services:
# - postgres:5432 (PostgreSQL 15)
# - redis:6379 (Redis 7)
# - api:5000 (Backend API)
# - worker (Background jobs)
```

---

## Supabase Setup

### 1. Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note the project URL and anon key

### 2. Database Schema
Run the SQL schemas:
- `supabase_schema_v6_clean.sql` — Main schema
- `supabase_schema_phone_proctoring.sql` — Phone proctoring tables

### 3. Storage Buckets
Create required storage buckets for:
- Session recordings
- Proctoring media
- Candidate documents

### 4. Edge Functions
Deploy edge functions:
```bash
supabase functions deploy openrouter-proxy
supabase functions deploy ai-fallback
supabase functions deploy admin-auth
supabase functions deploy cloudinary-sign
supabase functions deploy cleaup-proctoring-media
```

---

## Clerk Setup

1. Create a Clerk application
2. Enable email/password or social login
3. Create a JWT template for Supabase:
   - Name: `supabase`
   - Claims: `sub`, `email`, `role`
4. Copy the publishable key to `.env.local`

---

## AI Provider Setup

### OpenRouter (Primary)
1. Create account at [openrouter.ai](https://openrouter.ai)
2. Generate API key
3. Default model: `deepseek/deepseek-chat`

### Gemini (Optional)
1. Get API key from Google AI Studio
2. Key is proxied via Vite dev server
3. Add `VITE_GEMINI_API_KEY` to `.env.local`

---

## Admin Dashboard

### Access Control
- Admin emails stored in `system_settings` table
- Check via `isAdminEmail()` in `adminAccess.ts`
- Database-backed, not password-only

### Setup
1. Sign in with a Clerk account
2. Add email to `system_settings.admin_emails` in Supabase
3. Navigate to `/admin`

---

## VS Code Setup

Install Deno extension and add to `.vscode/settings.json`:

```json
{
  "files.associations": {
    "*.sql": "postgres"
  },
  "deno.enable": true,
  "deno.enablePaths": [
    "./supabase/functions"
  ]
}
```

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest tests |
| `npm run typecheck` | TypeScript type checking |
| `npm run ci:check` | Full CI check |

---

## Performance Testing

Located in `performance-tests/`:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run load tests
python run_scenarios.py

# Database audit
python db_audit.py

# Capacity analysis
python analyze_capacity.py
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Camera not working | Check HTTPS, browser permissions |
| Supabase connection failed | Verify URL and anon key |
| Clerk auth errors | Check JWT template configuration |
| AI evaluation failing | Verify OpenRouter API key |
| Phone proctoring issues | Check WebRTC/firewall settings |

### Health Check
The app runs automatic health checks on startup:
- Database connectivity
- Storage bucket availability
- Auth service reachability
