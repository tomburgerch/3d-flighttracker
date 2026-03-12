#!/usr/bin/env node
// Fetch FR24 flight data and generate flights.js with full-resolution tracks
// Usage: node scripts/fetch-fr24.js > js/flights.js

const FLIGHTS_META = [
  {
    fr24Id: '3eb0a433',
    timestamp: 1773205156,
    id: 'ZU-WBG-20260311-01',
    date: '2026-03-11',
    departure: { icao: 'FAFK', name: 'Fisantekraal' },
    arrival: { icao: 'FAFK', name: 'Fisantekraal' },
    label: 'Cape Town Area Scenic Flight (Saldanha Bay loop)',
  },
  {
    fr24Id: '3ea2c877',
    timestamp: 1772879430,
    id: 'ZU-WBG-20260307-01',
    date: '2026-03-07',
    departure: { icao: 'FAFK', name: 'Fisantekraal' },
    arrival: { icao: 'FARS', name: 'Robertson' },
    label: 'Fisantekraal → Robertson',
  },
  {
    fr24Id: '3ea31b46',
    timestamp: 1772887851,
    id: 'ZU-WBG-20260307-02',
    date: '2026-03-07',
    departure: { icao: 'FARS', name: 'Robertson' },
    arrival: { icao: 'FASH', name: 'Stellenbosch' },
    label: 'Robertson → Stellenbosch',
  },
];

const SAMPLE_INTERVAL = 10; // seconds between samples

async function fetchFlightTrack(fr24Id, timestamp) {
  const url = `https://api.flightradar24.com/common/v1/flight-playback.json?flightId=${fr24Id}&timestamp=${timestamp}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${fr24Id}`);
  const data = await res.json();
  const flight = data?.result?.response?.data?.flight;
  if (!flight?.track) throw new Error(`No track data for ${fr24Id}`);
  return flight;
}

function downsampleTrack(rawTrack, interval) {
  if (!rawTrack || rawTrack.length < 2) return [];
  const firstTs = rawTrack[0].timestamp;
  const result = [];
  let lastT = -Infinity;

  for (let i = 0; i < rawTrack.length; i++) {
    const p = rawTrack[i];
    const t = p.timestamp - firstTs;
    if (i === 0 || i === rawTrack.length - 1 || (t - lastT) >= interval) {
      result.push({
        t,
        lat: Math.round(p.latitude * 100000) / 100000,
        lng: Math.round(p.longitude * 100000) / 100000,
        alt: p.altitude?.feet || 0,
        spd: p.speed?.kts || 0,
        hdg: Math.round(p.heading || 0),
      });
      lastT = t;
    }
  }
  return result;
}

function formatTrack(track) {
  return track.map(p =>
    `      {t:${p.t},lat:${p.lat},lng:${p.lng},alt:${p.alt},spd:${p.spd},hdg:${p.hdg}}`
  ).join(',\n');
}

async function main() {
  const output = [];

  output.push(`// ============================================================`);
  output.push(`// 3D Flight Tracker - Real Flight Data for ZU-WBG`);
  output.push(`// ============================================================`);
  output.push(`// Aircraft: Sling TSi (ZU-WBG) - South African registered light aircraft`);
  output.push(`// Data source: FlightRadar24 playback API (full-resolution tracks)`);
  output.push(`// All altitudes in feet MSL, speeds in knots, headings in degrees`);
  output.push(`// ICAO hex: 00AE22`);
  output.push(`// Generated: ${new Date().toISOString()}`);
  output.push(`// ============================================================`);
  output.push(``);
  output.push(`// --- Live Tracking API Configuration ---`);
  output.push(`window.LIVE_TRACKING = {`);
  output.push(`  registration: 'ZU-WBG',`);
  output.push(`  icaoHex: '00AE22',`);
  output.push(`  apiBase: 'https://api.adsb.lol/v2',`);
  output.push(`  pollInterval: 5000,`);
  output.push(`  enabled: true,`);
  output.push(`};`);
  output.push(``);
  output.push(`window.FLIGHTS = [`);

  for (let i = 0; i < FLIGHTS_META.length; i++) {
    const meta = FLIGHTS_META[i];
    process.stderr.write(`Fetching ${meta.fr24Id} (${meta.label})...\n`);

    const flightData = await fetchFlightTrack(meta.fr24Id, meta.timestamp);
    const rawTrack = flightData.track;
    const track = downsampleTrack(rawTrack, SAMPLE_INTERVAL);

    const duration = Math.round((rawTrack[rawTrack.length - 1].timestamp - rawTrack[0].timestamp) / 60);
    const maxAlt = Math.max(...track.map(p => p.alt));

    // Get departure/arrival coordinates from track
    const depLat = track[0].lat;
    const depLng = track[0].lng;
    const arrLat = track[track.length - 1].lat;
    const arrLng = track[track.length - 1].lng;

    process.stderr.write(`  → ${rawTrack.length} raw points → ${track.length} sampled (${SAMPLE_INTERVAL}s interval)\n`);

    output.push(`  // ─────────────────────────────────────────────────────────`);
    output.push(`  // Flight ${i + 1}: ${meta.label}`);
    output.push(`  // FR24 ID: ${meta.fr24Id} | Duration: ${Math.floor(duration/60)}h${(duration%60).toString().padStart(2,'0')}m | ${rawTrack.length} raw → ${track.length} sampled`);
    output.push(`  // ─────────────────────────────────────────────────────────`);
    output.push(`  {`);
    output.push(`    id: "${meta.id}",`);
    output.push(`    date: "${meta.date}",`);
    output.push(`    fr24Id: "${meta.fr24Id}",`);
    output.push(`    aircraft: { registration: "ZU-WBG", type: "Sling TSi", icao: "00AE22" },`);
    output.push(`    departure: { icao: "${meta.departure.icao}", name: "${meta.departure.name}", lat: ${depLat}, lng: ${depLng} },`);
    output.push(`    arrival: { icao: "${meta.arrival.icao}", name: "${meta.arrival.name}", lat: ${arrLat}, lng: ${arrLng} },`);
    output.push(`    duration: ${duration},`);
    output.push(`    maxAlt: ${maxAlt},`);
    output.push(`    track: [`);
    output.push(formatTrack(track));
    output.push(`    ]`);
    output.push(`  }${i < FLIGHTS_META.length - 1 ? ',' : ''}`);
    output.push(``);
  }

  output.push(`];`);

  process.stdout.write(output.join('\n') + '\n');
}

main().catch(e => {
  process.stderr.write('Error: ' + e.message + '\n');
  process.exit(1);
});
