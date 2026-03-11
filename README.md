# Wagyu Wings - 3D Flight Tracker

A cinematic 3D flight tracker built with [CesiumJS](https://cesium.com/) for visualizing flights of ZU-WBG (Sling TSi).

![Yellow and black themed 3D globe with flight paths](https://img.shields.io/badge/CesiumJS-1.119-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **3D Globe Visualization** — Real flight paths rendered on a photorealistic 3D globe with terrain
- **Cinematic Camera** — Automatic dramatic camera swoop on page load, following the aircraft in flight
- **Auto-Play Animation** — Flights play automatically with a visible aircraft marker tracing the route
- **Live Tracking** — Real-time position tracking via [adsb.lol](https://adsb.lol) API when ZU-WBG is airborne
- **FR24 Auto-Sync** — Automatically fetches new flights from FlightRadar24 on each page load
- **Flight Playback Controls** — Play/pause, speed control (1x–200x), scrubber, follow mode
- **Altitude Profile** — Real-time altitude graph with progress marker
- **HUD Display** — Live altitude, speed, heading, and progress readouts
- **Keyboard Shortcuts** — Space (play/pause), S (speed), F (follow), R (restart), arrow keys (prev/next)

## Tech Stack

- **CesiumJS 1.119** — 3D globe rendering with terrain and imagery
- **FlightRadar24 API** — Real flight track data
- **adsb.lol API** — Live ADS-B position tracking
- **Vanilla JS** — No frameworks, pure JavaScript

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/cedricwaldburger/3d-flighttracker.git
   cd 3d-flighttracker
   ```

2. **Get a Cesium Ion token**
   - Sign up at [cesium.com/ion](https://ion.cesium.com/signup/)
   - Copy your default access token

3. **Configure the token** (choose one):
   - Create `js/config.js` with: `window.CESIUM_ION_TOKEN = 'your-token-here';`
   - Or enter it in the browser when prompted (saved to localStorage)

4. **Start a local server**
   ```bash
   npx serve -l 8090 --cors
   ```

5. **Open** `http://localhost:8090`

## Project Structure

```
3d-flighttracker/
├── index.html          # Main app with all styles
├── logo.svg            # Wagyu Wings logo
├── js/
│   ├── config.js       # Cesium Ion access token
│   ├── flights.js      # Flight data (tracks, metadata)
│   ├── fr24-sync.js    # FR24 auto-refresh module
│   └── app.js          # Main CesiumJS application
└── .claude/
    └── launch.json     # Dev server configuration
```

## Aircraft

- **Registration:** ZU-WBG
- **Type:** Sling TSi
- **ICAO Hex:** 00AE22
- **Base:** Cape Town, South Africa

## License

MIT
