// ============================================================
// 3D Flight Tracker - Real Flight Data for ZU-WBG
// ============================================================
// Aircraft: Sling TSi (ZU-WBG) - South African registered light aircraft
// Data source: FlightRadar24 flight playback API
// All altitudes in feet MSL, speeds in knots, headings in degrees
// ICAO hex: 00AE22
// ============================================================

// --- Live Tracking API Configuration ---
window.LIVE_TRACKING = {
  registration: 'ZU-WBG',
  icaoHex: '00AE22',
  apiBase: 'https://api.adsb.lol/v2',
  pollInterval: 5000,
  enabled: true,
};

window.FLIGHTS = [
  // ─────────────────────────────────────────────────────────
  // Flight 1: Cape Town Area Scenic Flight (Mar 11, 2026)
  // FR24 ID: 3eb0a433 | Duration: 2h39m | 2702 track points
  // West Coast / Saldanha Bay loop
  // ─────────────────────────────────────────────────────────
  {
    id: "ZU-WBG-20260311-01",
    date: "2026-03-11",
    fr24Id: "3eb0a433",
    aircraft: { registration: "ZU-WBG", type: "Sling TSi", icao: "00AE22" },
    departure: { icao: "FAFK", name: "Fisantekraal", lat: -33.7525, lng: 18.5477 },
    arrival: { icao: "FAFK", name: "Fisantekraal", lat: -33.7605, lng: 18.5497 },
    duration: 161,
    maxAlt: 5150,
    track: [
      { t: 0,    lat: -33.7525, lng: 18.5477, alt: 375,  spd: 0,   hdg: 358 },
      { t: 461,  lat: -33.5975, lng: 18.3868, alt: 2275, spd: 103, hdg: 297 },
      { t: 782,  lat: -33.4917, lng: 18.2900, alt: 4725, spd: 106, hdg: 339 },
      { t: 1173, lat: -33.3077, lng: 18.2208, alt: 4850, spd: 100, hdg: 354 },
      { t: 1549, lat: -33.1455, lng: 18.1404, alt: 4550, spd: 104, hdg: 312 },
      { t: 1808, lat: -33.0450, lng: 18.0622, alt: 4800, spd: 100, hdg: 319 },
      { t: 2178, lat: -32.9824, lng: 17.9493, alt: 3275, spd: 113, hdg: 102 },
      { t: 2657, lat: -32.9686, lng: 17.9541, alt: 925,  spd: 103, hdg: 177 },
      { t: 3137, lat: -32.9469, lng: 17.9576, alt: 1000, spd: 115, hdg: 221 },
      { t: 3861, lat: -32.9845, lng: 17.9621, alt: 575,  spd: 82,  hdg: 116 },
      { t: 4843, lat: -32.9491, lng: 17.9666, alt: 450,  spd: 94,  hdg: 316 },
      { t: 5629, lat: -32.9628, lng: 17.9555, alt: 825,  spd: 112, hdg: 179 },
      { t: 6143, lat: -32.9654, lng: 17.9506, alt: 950,  spd: 99,  hdg: 188 },
      { t: 6817, lat: -32.9594, lng: 17.9451, alt: 950,  spd: 108, hdg: 185 },
      { t: 7663, lat: -32.9630, lng: 17.9608, alt: 925,  spd: 105, hdg: 145 },
      { t: 7971, lat: -33.0889, lng: 18.0839, alt: 2975, spd: 120, hdg: 143 },
      { t: 8514, lat: -33.4089, lng: 18.2385, alt: 3475, spd: 148, hdg: 147 },
      { t: 8998, lat: -33.6638, lng: 18.4439, alt: 1950, spd: 146, hdg: 172 },
      { t: 9234, lat: -33.7606, lng: 18.5013, alt: 1675, spd: 108, hdg: 84  },
      { t: 9679, lat: -33.7605, lng: 18.5497, alt: 0,    spd: 4,   hdg: 354 }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // Flight 2: Cape Town → Robertson (Mar 7, 2026)
  // FR24 ID: 3ea2c877 | Duration: 0h54m | 1131 track points
  // ─────────────────────────────────────────────────────────
  {
    id: "ZU-WBG-20260307-01",
    date: "2026-03-07",
    fr24Id: "3ea2c877",
    aircraft: { registration: "ZU-WBG", type: "Sling TSi", icao: "00AE22" },
    departure: { icao: "FAFK", name: "Fisantekraal", lat: -33.7647, lng: 18.5486 },
    arrival: { icao: "FARS", name: "Robertson", lat: -33.8119, lng: 19.9028 },
    duration: 60,
    maxAlt: 5325,
    track: [
      { t: 0,    lat: -33.7647, lng: 18.5486, alt: 175,  spd: 79,  hdg: 175 },
      { t: 165,  lat: -33.7034, lng: 18.5436, alt: 925,  spd: 119, hdg: 9   },
      { t: 268,  lat: -33.6502, lng: 18.5649, alt: 1525, spd: 111, hdg: 29  },
      { t: 491,  lat: -33.5439, lng: 18.6292, alt: 3025, spd: 117, hdg: 24  },
      { t: 656,  lat: -33.4690, lng: 18.6895, alt: 3825, spd: 134, hdg: 38  },
      { t: 829,  lat: -33.4200, lng: 18.7793, alt: 3825, spd: 99,  hdg: 63  },
      { t: 926,  lat: -33.4080, lng: 18.8362, alt: 3725, spd: 100, hdg: 90  },
      { t: 1075, lat: -33.3846, lng: 18.9116, alt: 3675, spd: 101, hdg: 47  },
      { t: 1244, lat: -33.3258, lng: 18.9905, alt: 3675, spd: 124, hdg: 53  },
      { t: 1427, lat: -33.2910, lng: 19.0892, alt: 3550, spd: 113, hdg: 135 },
      { t: 1528, lat: -33.3387, lng: 19.1191, alt: 3550, spd: 111, hdg: 150 },
      { t: 1710, lat: -33.4222, lng: 19.1608, alt: 3375, spd: 96,  hdg: 159 },
      { t: 1916, lat: -33.5103, lng: 19.2014, alt: 3350, spd: 97,  hdg: 151 },
      { t: 2085, lat: -33.5744, lng: 19.2426, alt: 4800, spd: 99,  hdg: 151 },
      { t: 2206, lat: -33.6230, lng: 19.2823, alt: 5250, spd: 117, hdg: 143 },
      { t: 2622, lat: -33.7180, lng: 19.5265, alt: 5325, spd: 104, hdg: 92  },
      { t: 2861, lat: -33.7349, lng: 19.6590, alt: 4575, spd: 93,  hdg: 99  },
      { t: 3025, lat: -33.7680, lng: 19.7464, alt: 3425, spd: 117, hdg: 132 },
      { t: 3126, lat: -33.8033, lng: 19.7910, alt: 3250, spd: 114, hdg: 109 },
      { t: 3629, lat: -33.8119, lng: 19.9028, alt: 0,    spd: 6,   hdg: 247 }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // Flight 3: Robertson → Cape Town (Mar 7, 2026)
  // FR24 ID: 3ea31b46 | Duration: 0h49m | 920 track points
  // ─────────────────────────────────────────────────────────
  {
    id: "ZU-WBG-20260307-02",
    date: "2026-03-07",
    fr24Id: "3ea31b46",
    aircraft: { registration: "ZU-WBG", type: "Sling TSi", icao: "00AE22" },
    departure: { icao: "FARS", name: "Robertson", lat: -33.8125, lng: 19.9020 },
    arrival: { icao: "FASH", name: "Stellenbosch", lat: -33.9793, lng: 18.8206 },
    duration: 63,
    maxAlt: 6175,
    track: [
      { t: 0,    lat: -33.8125, lng: 19.9020, alt: 0,    spd: 0,   hdg: 84  },
      { t: 646,  lat: -33.8036, lng: 19.8050, alt: 3350, spd: 109, hdg: 298 },
      { t: 754,  lat: -33.7694, lng: 19.7491, alt: 4075, spd: 121, hdg: 311 },
      { t: 934,  lat: -33.7110, lng: 19.6407, alt: 4275, spd: 134, hdg: 291 },
      { t: 1251, lat: -33.7205, lng: 19.4614, alt: 6100, spd: 139, hdg: 210 },
      { t: 1477, lat: -33.8384, lng: 19.3840, alt: 4450, spd: 107, hdg: 190 },
      { t: 1574, lat: -33.8906, lng: 19.3735, alt: 4600, spd: 117, hdg: 200 },
      { t: 1865, lat: -34.0122, lng: 19.2463, alt: 6175, spd: 140, hdg: 279 },
      { t: 2256, lat: -33.8848, lng: 19.0267, alt: 4175, spd: 81,  hdg: 105 },
      { t: 2380, lat: -33.8502, lng: 18.9866, alt: 1900, spd: 116, hdg: 312 },
      { t: 2497, lat: -33.8063, lng: 18.9238, alt: 1775, spd: 118, hdg: 302 },
      { t: 2622, lat: -33.8026, lng: 18.8496, alt: 1825, spd: 112, hdg: 253 },
      { t: 2763, lat: -33.8446, lng: 18.7984, alt: 1800, spd: 83,  hdg: 196 },
      { t: 2882, lat: -33.8912, lng: 18.8060, alt: 1700, spd: 83,  hdg: 158 },
      { t: 2961, lat: -33.9199, lng: 18.8154, alt: 1575, spd: 88,  hdg: 167 },
      { t: 3082, lat: -33.9658, lng: 18.8275, alt: 1275, spd: 78,  hdg: 170 },
      { t: 3201, lat: -33.9653, lng: 18.8027, alt: 825,  spd: 102, hdg: 338 },
      { t: 3326, lat: -33.9741, lng: 18.8196, alt: 150,  spd: 54,  hdg: 161 },
      { t: 3461, lat: -33.9833, lng: 18.8225, alt: 0,    spd: 6,   hdg: 343 },
      { t: 3776, lat: -33.9793, lng: 18.8206, alt: 0,    spd: 3,   hdg: 253 }
    ]
  }
];
