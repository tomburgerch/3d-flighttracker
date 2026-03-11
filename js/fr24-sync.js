// ============================================================
// FR24 Flight Data Auto-Sync
// ============================================================
// Checks FlightRadar24 for recent flights of ZU-WBG and adds
// any new flights that aren't already in the flights list.
// Uses the FR24 playback API via CORS proxy.
// ============================================================

(function () {
  'use strict';

  const FR24_CONFIG = {
    registration: 'ZU-WBG',
    icaoHex: '00AE22',
    // FR24 flight list endpoint
    flightListUrl: 'https://api.flightradar24.com/common/v1/flight/list.json',
    playbackUrl: 'https://api.flightradar24.com/common/v1/flight-playback.json',
    maxTrackPoints: 20, // Downsample to this many points
  };

  // Check if a flight ID already exists in our data
  function flightExists(fr24Id) {
    return window.FLIGHTS.some(f => f.fr24Id === fr24Id);
  }

  // Downsample a track to maxPoints evenly-spaced points
  function downsampleTrack(rawTrack, maxPoints) {
    if (rawTrack.length <= maxPoints) return rawTrack;
    const result = [rawTrack[0]]; // Always keep first
    const step = (rawTrack.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
      result.push(rawTrack[Math.round(i * step)]);
    }
    result.push(rawTrack[rawTrack.length - 1]); // Always keep last
    return result;
  }

  // Convert FR24 playback data to our flight format
  function convertFR24Flight(playbackData, fr24Id) {
    const flight = playbackData.result?.response?.data?.flight;
    if (!flight || !flight.track) return null;

    const rawTrack = flight.track;
    if (rawTrack.length < 5) return null;

    const firstTimestamp = rawTrack[0].timestamp;

    // Downsample
    const sampled = downsampleTrack(rawTrack, FR24_CONFIG.maxTrackPoints);

    const track = sampled.map(p => ({
      t: p.timestamp - firstTimestamp,
      lat: Math.round(p.latitude * 10000) / 10000,
      lng: Math.round(p.longitude * 10000) / 10000,
      alt: p.altitude?.feet || 0,
      spd: p.speed?.kts || 0,
      hdg: p.heading || 0,
    }));

    // Extract date from first timestamp
    const dateObj = new Date(firstTimestamp * 1000);
    const dateStr = dateObj.toISOString().split('T')[0];

    // Duration in minutes
    const duration = Math.round(
      (rawTrack[rawTrack.length - 1].timestamp - rawTrack[0].timestamp) / 60
    );

    // Max altitude
    const maxAlt = Math.max(...sampled.map(p => p.altitude?.feet || 0));

    // Airport info
    const depAirport = flight.airport?.origin;
    const arrAirport = flight.airport?.destination;

    const departure = {
      name: depAirport?.name || depAirport?.code?.iata || 'Unknown',
      lat: track[0].lat,
      lng: track[0].lng,
    };
    if (depAirport?.code?.icao) departure.icao = depAirport.code.icao;

    const arrival = {
      name: arrAirport?.name || arrAirport?.code?.iata || departure.name,
      lat: track[track.length - 1].lat,
      lng: track[track.length - 1].lng,
    };
    if (arrAirport?.code?.icao) arrival.icao = arrAirport.code.icao;

    return {
      id: `ZU-WBG-${dateStr.replace(/-/g, '')}-${fr24Id.substring(0, 4)}`,
      date: dateStr,
      fr24Id: fr24Id,
      aircraft: { registration: 'ZU-WBG', type: 'Sling TSi', icao: FR24_CONFIG.icaoHex },
      departure,
      arrival,
      duration,
      maxAlt,
      track,
    };
  }

  // Fetch recent flights for the aircraft
  async function fetchRecentFlights() {
    try {
      // Try to get flight list from FR24
      const listUrl = `${FR24_CONFIG.flightListUrl}?query=${FR24_CONFIG.registration}&fetchBy=reg&page=1&limit=10`;
      const listRes = await fetch(listUrl);
      if (!listRes.ok) {
        console.log('[FR24 Sync] Flight list API returned', listRes.status);
        return [];
      }

      const listData = await listRes.json();
      const flights = listData.result?.response?.data || [];

      // Filter to only flights we don't already have
      const newFlightIds = [];
      for (const f of flights) {
        const id = f.identification?.id;
        if (id && !flightExists(id)) {
          newFlightIds.push(id);
        }
      }

      if (newFlightIds.length === 0) {
        console.log('[FR24 Sync] No new flights found');
        return [];
      }

      console.log(`[FR24 Sync] Found ${newFlightIds.length} new flight(s), fetching tracks...`);

      // Fetch playback data for each new flight
      const newFlights = [];
      for (const fid of newFlightIds.slice(0, 5)) { // Max 5 at a time
        try {
          const pbUrl = `${FR24_CONFIG.playbackUrl}?flightId=${fid}`;
          const pbRes = await fetch(pbUrl);
          if (!pbRes.ok) continue;

          const pbData = await pbRes.json();
          const converted = convertFR24Flight(pbData, fid);
          if (converted) {
            newFlights.push(converted);
            console.log(`[FR24 Sync] Added flight ${fid} (${converted.date})`);
          }
        } catch (e) {
          console.warn(`[FR24 Sync] Failed to fetch flight ${fid}:`, e);
        }
      }

      return newFlights;
    } catch (e) {
      console.log('[FR24 Sync] API unavailable:', e.message);
      return [];
    }
  }

  // Main sync function - call on page load
  async function syncFlights() {
    const newFlights = await fetchRecentFlights();
    if (newFlights.length === 0) return false;

    // Add new flights to the beginning of the array (newest first)
    window.FLIGHTS.unshift(...newFlights);

    // Sort all flights by date descending
    window.FLIGHTS.sort((a, b) => b.date.localeCompare(a.date));

    console.log(`[FR24 Sync] Added ${newFlights.length} new flight(s). Total: ${window.FLIGHTS.length}`);
    return true;
  }

  // Expose globally
  window.FR24_SYNC = {
    sync: syncFlights,
    fetchRecent: fetchRecentFlights,
  };
})();
