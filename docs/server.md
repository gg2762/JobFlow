# JOBFLOW Server Operations

Brief ops reference for the local capture server. Will be folded into `docs/` during the open-source restructure.

---

## Where it runs

- **Process:** Node.js `server.js` listening on `127.0.0.1:3737` (loopback only — not reachable from the internet).
- **Manager:** macOS `launchd` agent at `~/Library/LaunchAgents/com.jobflow.server.plist`.
- **Auto-start:** boots at login (`RunAtLoad=true`), restarts on crash (`KeepAlive=true`).
- **Working directory:** `~/jobflow/`.

## Endpoints

| Method | Path                | Purpose |
|--------|---------------------|---------|
| GET    | `/`                 | Dashboard (HTML) |
| GET    | `/health`           | `{ "ok": true }` — used by the Chrome extension popup |
| GET    | `/queue`            | All rows as JSON (truncated `jd_text`) |
| GET    | `/queue?full=1`     | All rows as JSON (untruncated) |
| POST   | `/capture`          | Append a row (used by the Chrome extension) |
| POST   | `/row/<id>/update`  | Update specific columns on a row |
| GET    | `/assets/<file>`    | Static files from `jobflow/assets/` |

## Quick checks

```bash
# Is the server up?
curl -sS http://localhost:3737/health
# Expected: {"ok":true}

# Is the LaunchAgent loaded?
launchctl list | grep jobflow

# What's in the queue right now?
curl -sS http://localhost:3737/queue | python3 -m json.tool
```

## Logs

```bash
# Live tail
tail -f ~/jobflow/server.log
tail -f ~/jobflow/server.err.log

# Recent activity (last 50 lines, both streams)
tail -n 50 ~/jobflow/server.{log,err.log}
```

Normal log entries:
- `[capture] cap_xxx ← domain : title` — extension saved a row
- `[update] cap_xxx ← status,...` — `/process-queue`, `/answer-questions`, or dashboard updated a row

## Restart / stop / start

```bash
# Hot reload (e.g., after editing server.js)
launchctl unload ~/Library/LaunchAgents/com.jobflow.server.plist
launchctl load   ~/Library/LaunchAgents/com.jobflow.server.plist

# Stop completely (no auto-restart until you load it again)
launchctl unload ~/Library/LaunchAgents/com.jobflow.server.plist

# Start
launchctl load ~/Library/LaunchAgents/com.jobflow.server.plist
```

## Changing the port

If `3737` ever conflicts with another app:

1. Edit `server.js` — change `const PORT = 3737;` to your chosen port.
2. Edit `extension/popup.js` — change `const SERVER = 'http://localhost:3737';` to match.
3. Reload the LaunchAgent (commands above).
4. Reload the Chrome extension at `chrome://extensions/` → click the refresh icon on the JOBFLOW Capture card.
5. Update bookmarks pointing to the old dashboard URL.

Why these three places: the server binds the port, the extension calls it, and your browser caches the URL.

## Troubleshooting

### "Server offline" in the extension popup

1. Check it's actually down: `curl -sS http://localhost:3737/health`. No response → confirmed down.
2. Check LaunchAgent state: `launchctl list | grep jobflow`. If absent, reload (commands above).
3. If loaded but still down, check `server.err.log` for the failure reason. Common causes:
   - **Port conflict** — another process grabbed `:3737`. Find it: `lsof -i :3737`. Either kill that process or change JOBFLOW's port (above).
   - **Node not found** — macOS upgrade may have moved or removed Node. `which node` should print a path; update `ProgramArguments[0]` in the plist if different from `/usr/local/bin/node`.
   - **Permissions** — if you moved the project folder, the LaunchAgent's `WorkingDirectory` is stale. Edit the plist.

### Dashboard loads but no rows appear

- Check the CSV exists: `ls -la ~/jobflow/queue.csv`
- Header row should match the 14-column schema. The server auto-migrates on startup if it doesn't.
- Hit `GET /queue` directly to confirm what the server is returning.

### Extension can't save

- Open the popup — the health dot tells you if the server is reachable.
- If health is green but Save fails, open Chrome DevTools on the popup (right-click popup → Inspect) and check the Network tab for the POST `/capture` request.

### After editing `server.js`

The LaunchAgent doesn't auto-reload on file changes. Always run the unload + load cycle (above) to pick up edits.

## Disable the server entirely

```bash
launchctl unload ~/Library/LaunchAgents/com.jobflow.server.plist
# To re-enable later: launchctl load ~/Library/LaunchAgents/com.jobflow.server.plist

# To permanently uninstall:
rm ~/Library/LaunchAgents/com.jobflow.server.plist
```

## What's private vs. exposed

- The server binds to `127.0.0.1` (loopback). It is **not** reachable from your local network or the internet.
- The CSV stays on your disk at `~/jobflow/queue.csv`.
- The Chrome extension talks to `localhost:3737` only — nothing leaves your machine via this surface.
- The dashboard at `http://localhost:3737/` is accessible only from the Mac itself.

If you ever want to access the dashboard from your phone on the same WiFi (uncommon), you'd change the bind from `'127.0.0.1'` to `'0.0.0.0'` in `server.js`. **Don't do this on untrusted networks** — anyone on the LAN could read your queue.
