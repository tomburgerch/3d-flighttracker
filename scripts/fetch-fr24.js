#!/usr/bin/env node
// Fetch FR24 flight data and generate flights.js with full-resolution tracks
// Usage: node scripts/fetch-fr24.js > js/flights.js

// All flights for ZU-WBG extracted from FlightRadar24
const FLIGHTS_META = [
  { fr24Id: '3eb0a433', timestamp: 1773205156, date: '2026-03-11' },
  { fr24Id: '3ea39252', timestamp: 1772897313, date: '2026-03-07' },
  { fr24Id: '3ea31b46', timestamp: 1772887851, date: '2026-03-07' },
  { fr24Id: '3ea2c877', timestamp: 1772879430, date: '2026-03-07' },
  { fr24Id: '3e97fb29', timestamp: 1772634244, date: '2026-03-04' },
  { fr24Id: '3e9732ad', timestamp: 1772616954, date: '2026-03-04' },
  { fr24Id: '3e937fd8', timestamp: 1772531954, date: '2026-03-03' },
  { fr24Id: '3e931bf8', timestamp: 1772520559, date: '2026-03-03' },
  { fr24Id: '3e8fdf39', timestamp: 1772452741, date: '2026-03-02' },
  { fr24Id: '3e8f9111', timestamp: 1772445321, date: '2026-03-02' },
  { fr24Id: '3e8f41db', timestamp: 1772435961, date: '2026-03-02' },
  { fr24Id: '3e88264f', timestamp: 1772263749, date: '2026-02-28' },
  { fr24Id: '3e8444ca', timestamp: 1772183306, date: '2026-02-27' },
  { fr24Id: '3e83f589', timestamp: 1772174814, date: '2026-02-27' },
  { fr24Id: '3e788030', timestamp: 1771932269, date: '2026-02-24' },
  { fr24Id: '3e6d72ce', timestamp: 1771659577, date: '2026-02-21' },
  { fr24Id: '3e602938', timestamp: 1771344424, date: '2026-02-17' },
  { fr24Id: '3e5ff775', timestamp: 1771340689, date: '2026-02-17' },
  { fr24Id: '3d8e35b4', timestamp: 1766033422, date: '2025-12-18' },
  { fr24Id: '3d86c38d', timestamp: 1765861904, date: '2025-12-16' },
];

const SAMPLE_INTERVAL = 10; // seconds between samples

// Known airports near ZU-WBG's operating area
// FAFK has been renamed to FAWN (Morningstar airfield, formerly Fisantekraal)
const KNOWN_AIRPORTS = [
  { icao: 'FAWN', name: 'Morningstar', lat: -33.7700, lng: 18.5330, radius: 8 },
  { icao: 'FARS', name: 'Robertson', lat: -33.8100, lng: 19.9000, radius: 8 },
  { icao: 'FASH', name: 'Stellenbosch', lat: -33.9900, lng: 18.8200, radius: 8 },
  { icao: 'FAGG', name: 'George', lat: -34.0056, lng: 22.3789, radius: 12 },
  { icao: 'FACT', name: 'Cape Town Intl', lat: -33.9715, lng: 18.6021, radius: 8 },
  { icao: 'FAGR', name: 'Graaff-Reinet', lat: -32.1936, lng: 24.5414, radius: 10 },
  { icao: 'FASA', name: 'Saldanha', lat: -33.0633, lng: 17.9333, radius: 10 },
  { icao: 'FALW', name: 'Langebaan', lat: -33.0928, lng: 18.1600, radius: 10 },
];

function identifyAirport(lat, lng) {
  for (const ap of KNOWN_AIRPORTS) {
    const dlat = lat - ap.lat;
    const dlng = lng - ap.lng;
    const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111; // rough km
    if (dist < ap.radius) {
      return { icao: ap.icao, name: ap.name };
    }
  }
  return null;
}

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function fetchFlightTrack(fr24Id) {
  // Note: omitting timestamp param — it causes 400 errors for older flights
  const url = `https://api.flightradar24.com/common/v1/flight-playback.json?flightId=${fr24Id}`;
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
  const flightsData = [];

  output.push(`// ============================================================`);
  output.push(`// 3D Flight Tracker - Real Flight Data for ZU-WBG`);
  output.push(`// ============================================================`);
  output.push(`// Aircraft: Sling TSi (ZU-WBG) - South African registered light aircraft`);
  output.push(`// Data source: FlightRadar24 playback API (full-resolution tracks)`);
  output.push(`// All altitudes in feet MSL, speeds in knots, headings in degrees`);
  output.push(`// ICAO hex: 00AE22`);
  output.push(`// Home base: Morningstar (FAWN, formerly FAFK/Fisantekraal)`);
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

  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < FLIGHTS_META.length; i++) {
    const meta = FLIGHTS_META[i];
    process.stderr.write(`[${i+1}/${FLIGHTS_META.length}] Fetching ${meta.fr24Id} (${meta.date})... `);

    try {
      const flightData = await fetchFlightTrack(meta.fr24Id);
      const rawTrack = flightData.track;

      if (!rawTrack || rawTrack.length < 5) {
        process.stderr.write(`SKIP (only ${rawTrack?.length || 0} points)\n`);
        skipCount++;
        continue;
      }

      const track = downsampleTrack(rawTrack, SAMPLE_INTERVAL);

      const duration = Math.round((rawTrack[rawTrack.length - 1].timestamp - rawTrack[0].timestamp) / 60);
      const maxAlt = Math.max(...track.map(p => p.alt));

      // Get departure/arrival from track endpoints
      const depLat = track[0].lat;
      const depLng = track[0].lng;
      const arrLat = track[track.length - 1].lat;
      const arrLng = track[track.length - 1].lng;

      // Identify airports from coordinates
      const depAirport = identifyAirport(depLat, depLng) || { icao: 'UNKN', name: 'Unknown' };
      const arrAirport = identifyAirport(arrLat, arrLng) || { icao: 'UNKN', name: 'Unknown' };

      // Compute total distance
      let totalDist = 0;
      for (let j = 1; j < track.length; j++) {
        totalDist += distKm(track[j-1].lat, track[j-1].lng, track[j].lat, track[j].lng);
      }

      // Generate label
      let label;
      if (depAirport.icao === arrAirport.icao) {
        label = `${depAirport.name} (scenic)`;
      } else {
        label = `${depAirport.name} → ${arrAirport.name}`;
      }

      // Generate unique ID
      const flightNum = flightsData.filter(f => f.date === meta.date).length + 1;
      const id = `ZU-WBG-${meta.date.replace(/-/g, '')}-${String(flightNum).padStart(2, '0')}`;

      process.stderr.write(`OK (${rawTrack.length} raw → ${track.length} sampled, ${label})\n`);

      const entry = {
        id, date: meta.date, fr24Id: meta.fr24Id,
        dep: depAirport, arr: arrAirport,
        depLat, depLng, arrLat, arrLng,
        duration, maxAlt, totalDist: Math.round(totalDist),
        label, track,
      };
      flightsData.push(entry);
      successCount++;
    } catch (err) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      skipCount++;
    }
  }

  // Sort by date descending
  flightsData.sort((a, b) => b.date.localeCompare(a.date) || b.fr24Id.localeCompare(a.fr24Id));

  for (let i = 0; i < flightsData.length; i++) {
    const f = flightsData[i];
    const durStr = `${Math.floor(f.duration/60)}h${(f.duration%60).toString().padStart(2,'0')}m`;

    output.push(`  // ─────────────────────────────────────────────────────────`);
    output.push(`  // ${f.label} | ${f.date} | ${durStr} | ${f.totalDist} km`);
    output.push(`  // FR24 ID: ${f.fr24Id} | ${f.track.length} track points`);
    output.push(`  // ─────────────────────────────────────────────────────────`);
    output.push(`  {`);
    output.push(`    id: "${f.id}",`);
    output.push(`    date: "${f.date}",`);
    output.push(`    fr24Id: "${f.fr24Id}",`);
    output.push(`    aircraft: { registration: "ZU-WBG", type: "Sling TSi", icao: "00AE22" },`);
    output.push(`    departure: { icao: "${f.dep.icao}", name: "${f.dep.name}", lat: ${f.depLat}, lng: ${f.depLng} },`);
    output.push(`    arrival: { icao: "${f.arr.icao}", name: "${f.arr.name}", lat: ${f.arrLat}, lng: ${f.arrLng} },`);
    output.push(`    duration: ${f.duration},`);
    output.push(`    maxAlt: ${f.maxAlt},`);
    output.push(`    distance: ${f.totalDist},`);
    output.push(`    track: [`);
    output.push(formatTrack(f.track));
    output.push(`    ]`);
    output.push(`  }${i < flightsData.length - 1 ? ',' : ''}`);
    output.push(``);
  }

  output.push(`];`);

  process.stdout.write(output.join('\n') + '\n');
  process.stderr.write(`\nDone: ${successCount} flights, ${skipCount} skipped\n`);
}

main().catch(e => {
  process.stderr.write('Error: ' + e.message + '\n');
  process.exit(1);
});
