# Pixel Office 3D Bridge Contract

Pixel Office is the backend-of-record for Claw3D integration in this project.

## Boundary

- Pixel Office <-> OpenClaw (internal)
- Pixel Office <-> Claw3D (bridge)
- **Never** Claw3D <-> OpenClaw directly for this integration flow

## Endpoints

### `POST /api/3d/session`

Create a 3D session from Pixel Office context.

Request example:

```json
{
  "source": "pixeloffice-ui",
  "actorId": "frontdesk",
  "taskId": 42,
  "ui": {
    "selectedAgentId": "frontdesk",
    "showScrum": true,
    "showChat": false,
    "showTimeTasks": true
  }
}
```

Response includes:

- `sessionId`
- bridge endpoints (`/api/3d/session`, `/api/3d/event`, `/api/3d/state`)
- `claw3d.launchUrl` for opening Claw3D pointed at Pixel Office

### `POST /api/3d/event`

Record interaction events from Claw3D (or UI integration points).

Request example:

```json
{
  "sessionId": "px3d_abc123",
  "eventType": "movement",
  "actorId": "frontdesk",
  "payload": {
    "zoneId": "conference"
  }
}
```

### `GET /api/3d/state?sessionId=<id>`

Fetch current simulation + narrative state and recent event history for a 3D session.

## UI integration

The Pixel Office sidebar **Go 3D** button:

1. creates a session via `POST /api/3d/session`,
2. emits a click event via `POST /api/3d/event`,
3. opens Claw3D with Pixel Office bridge URLs.
