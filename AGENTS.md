# AGENTS.md

## Project overview

**Football Strike** is a client-only static crash/aviator betting game (HTML, CSS, vanilla JavaScript). There is no backend, build step, package manager, or test suite.

## Cursor Cloud specific instructions

### Running the app

Start a static HTTP server from the repo root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser. Do not rely on `file://` for normal development; use HTTP so asset paths behave consistently.

For long-running sessions in Cloud Agent VMs, prefer a tmux-backed server (example session name: `football-strike-server`).

### Lint / test / build

There are no lint, test, or build scripts in this repository. Verification is manual: confirm the page loads, place a bet (`APOSTAR`), watch the multiplier rise, and cash out (`COBRAR`) or let the round crash.

### External dependencies

- **Python 3** — only to serve static files locally; not a runtime dependency of the game.
- **Modern browser** — Canvas, `localStorage`, ES6 classes.
- **Google Fonts CDN** — optional; fonts fall back if offline.

### Persistence

Game state uses browser `localStorage` keys `footballAviatorHistory` and `footballAviatorPlayed`. No database or environment variables are required.
