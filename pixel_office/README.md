# Pixel Office

A 2D pixel art office visualization for AI agents using HTML Canvas and React.

## Features

- **Live Agent Mode**: Real-time agent status from backend API
- **Privacy System**: Agents can be public, private, or offline
- **View Modes**: Public (respects privacy) or Operator (shows all)
- **Interactive Canvas**: Agents walk, work, and wander in the office
- **Terminal Endpoint**: `/command` - A retro terminal interface
- **Collapsible Dashboard**: Parameters panel that can be hidden

## Quick Start

```bash
# Install dependencies
cd pixel_office
npm install

# Start backend server (port 4173) - serves /command endpoint
npm run dev:server

# Start frontend dev server (port 5173) - in another terminal
npm run dev
```

Or run both together:
```bash
npm run live  # builds and starts backend server
```

**Note:** Both servers must be running for the Terminal link to work. The frontend proxies `/command` requests to the backend on port 4173.

Open http://localhost:5173 in your browser.

## Claw3D bridge (Pixel Office as backend)

Pixel Office exposes a narrow 3D bridge contract so Claw3D can run against Pixel Office
without directly calling OpenClaw APIs:

- `POST /api/3d/session` - create/start a 3D session using current Pixel Office context
- `POST /api/3d/event` - ingest 3D interaction/user events
- `GET /api/3d/state` - return current 3D simulation/narrative state

The sidebar includes a **Go 3D** button that:
1. creates a Pixel Office 3D session via `/api/3d/session`,
2. records a click event via `/api/3d/event`,
3. opens Claw3D with a launch URL that points back to Pixel Office endpoints.

Optional env:

- `CLAW3D_URL` (default: `http://localhost:3000`) - base URL used for launch links.

## Running Tests

```bash
# From the workspace root
cd /home/sherlockhums/.openclaw/workspace
source lobsterenv/bin/activate
python3 tools/smoke_playwright.py
```

## Configuration

### Visibility Settings

Edit `~/.openclaw/workspace-main/memory/logs/agent-visibility.json`:

```json
{
  "sherlock": {
    "visibility": "public",
    "note": "Deep work mode"
  },
  "sherlobster": {
    "visibility": "public"
  },
  "hercule-prawnro": {
    "visibility": "public"
  }
}
```

Valid values: `public`, `private`, `offline`

### Environment

- **Backend Port**: 4173
- **Frontend Port**: 5173
- **API Endpoint**: `/api/employee-status`

### Database Setup

pixel_office uses **pixel_memory** for persistent storage (entities, memory entries, preferences).

1. **Copy the environment template:**
   ```bash
   cp .env.template .env
   ```

2. **Edit `.env`** with your database credentials:
   ```
   CORE_DB_HOST=localhost        # Database host
   CORE_DB_PORT=5432            # Port (5432 postgres, 3306 mysql)
   CORE_DB_NAME=hermit_core     # Database name
   CORE_DB_USER=pixel_app      # Database user
   CORE_DB_PASS=your_password   # Database password
   CORE_DB_TYPE=postgres       # "postgres" or "mysql"
   ```

3. **Create the database** (if it doesn't exist):
   ```bash
   # For PostgreSQL
   createdb <DB_NAME> -U <DB_USER> -h <DB_HOST>

   # For MySQL
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS <DB_NAME>;"
   ```

   Replace `<DB_NAME>`, `<DB_USER>`, and `<DB_HOST>` with the values from your `.env`.

4. **Run migrations:**
   ```bash
   npm run pixel_memory:migrate
   ```

This creates the following tables:
- `entities` - Things in life (people, projects, places, systems)
- `mem_entries` - Atomic notes, tasks, events, reflections, logs
- `prefs` - Long-lived preferences and settings
- `pixel_state` - Stateful UI bits per-app

## Privacy & View Modes

| Mode | Behavior |
|------|----------|
| **Public** | Respects agent visibility settings |
| **Operator** | Shows all agents with real status |

| Visibility | Door | Agent | Status Bar |
|------------|------|-------|-------------|
| `public` | Open, green light | Visible | Working/Idle |
| `private` | Closed, purple light | Visible | "Busy" + "[Private]" |
| `offline` | Dark, no light | Hidden | "Offline" |

## Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run dev:server` - Start backend server

## Files

- `src/components/PixelOffice.tsx` - Main React component
- `src/utils/drawOffice.ts` - Canvas rendering
- `src/utils/agentLogic.ts` - Agent movement logic
- `server/index.ts` - Express backend API
- `computer_screen.html` - Terminal screen (served at `/command`)
