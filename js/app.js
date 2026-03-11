// ============================================================
// 3D Flight Tracker - Main Application
// ============================================================
// CesiumJS-based 3D flight visualization for light aircraft
// ============================================================

(function () {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    defaultSpeed: 10,
    speeds: [1, 2, 5, 10, 25, 50],
    pathColor: '#FFD700',
    pathGlowColor: '#FFE44D',
    groundShadowAlpha: 0.25,
    wallAlpha: 0.12,
    trailWidth: 3,
    // Chase camera settings
    chaseRange: 1200,    // meters behind
    chasePitch: -15,     // degrees (look slightly down)
    chaseSmoothing: 0.04, // heading lerp factor (0-1, lower = smoother)
  };

  // --- State ---
  const state = {
    viewer: null,
    currentFlight: null,
    currentFlightIndex: -1,
    aircraftEntity: null,
    flightEntities: [],
    isPlaying: false,
    speedMultiplier: CONFIG.defaultSpeed,
    isFollowing: true,
    profileCanvas: null,
    profileCtx: null,
    // Live tracking
    liveMode: false,
    liveEntity: null,
    liveTrailEntity: null,
    liveTrailPositions: [],
    livePollTimer: null,
    liveLastData: null,
    // Chase camera state
    cameraHeading: 0,
    currentHeading: 0,
    aircraftIconUrl: null,
  };

  // ============================================================
  // Token Management
  // ============================================================

  function getToken() {
    return localStorage.getItem('cesium_ion_token');
  }

  function saveToken(token) {
    localStorage.setItem('cesium_ion_token', token.trim());
  }

  function showTokenModal() {
    document.getElementById('tokenModal').classList.add('visible');
  }

  function hideTokenModal() {
    document.getElementById('tokenModal').classList.remove('visible');
  }

  // ============================================================
  // Aircraft Icon (Sling TSi 916 top-down silhouette)
  // ============================================================

  function createAircraftIcon() {
    const s = 128;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');
    const cx = s / 2;
    const cy = s / 2;

    ctx.save();
    ctx.translate(cx, cy);

    const gold = '#FFE44D';
    const darkGold = '#B8960F';

    // Glow effect
    ctx.shadowColor = 'rgba(255, 228, 77, 0.6)';
    ctx.shadowBlur = 8;

    // === Fuselage ===
    ctx.fillStyle = gold;
    ctx.strokeStyle = darkGold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -38);  // nose tip
    ctx.bezierCurveTo(3, -34, 5, -20, 5, 0);
    ctx.lineTo(5, 28);
    ctx.quadraticCurveTo(5, 34, 0, 36); // tail cone
    ctx.quadraticCurveTo(-5, 34, -5, 28);
    ctx.lineTo(-5, 0);
    ctx.bezierCurveTo(-5, -20, -3, -34, 0, -38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // === Wings ===
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-40, 6);     // left wingtip leading
    ctx.lineTo(-38, 10);    // left wingtip trailing
    ctx.lineTo(-5, 4);
    ctx.lineTo(5, 4);
    ctx.lineTo(38, 10);     // right wingtip trailing
    ctx.lineTo(40, 6);      // right wingtip leading
    ctx.lineTo(5, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wing stripes (detail)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(-35, 8);
    ctx.moveTo(8, 0);  ctx.lineTo(35, 8);
    ctx.stroke();

    // === Horizontal Stabilizer ===
    ctx.fillStyle = gold;
    ctx.strokeStyle = darkGold;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(-4, 26);
    ctx.lineTo(-18, 31);
    ctx.lineTo(-16, 34);
    ctx.lineTo(-4, 32);
    ctx.lineTo(4, 32);
    ctx.lineTo(16, 34);
    ctx.lineTo(18, 31);
    ctx.lineTo(4, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // === Vertical Stabilizer (top-down = thin line) ===
    ctx.strokeStyle = darkGold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(0, 35);
    ctx.stroke();

    // === Propeller disc ===
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, -40, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // === Cockpit canopy ===
    ctx.fillStyle = 'rgba(120,200,255,0.4)';
    ctx.strokeStyle = 'rgba(120,200,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -18, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // === Engine cowling highlight ===
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, -32, 3, 4, 0, -Math.PI, 0);
    ctx.fill();

    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  // ============================================================
  // Chase Camera
  // ============================================================

  function setupChaseCamera(viewer) {
    viewer.scene.preUpdate.addEventListener(function () {
      if (!state.isFollowing || !state.aircraftEntity) return;
      if (state.liveMode) return;
      if (!state.isPlaying && !state.currentFlight) return;

      const time = viewer.clock.currentTime;
      const position = state.aircraftEntity.position.getValue(time);
      if (!position) return;

      // Get future position to determine heading
      const dt = 10;
      const futureTime = Cesium.JulianDate.addSeconds(time, dt, new Cesium.JulianDate());
      const futurePos = state.aircraftEntity.position.getValue(futureTime);
      if (!futurePos) return;

      const carto = Cesium.Cartographic.fromCartesian(position);
      const futureCarto = Cesium.Cartographic.fromCartesian(futurePos);

      const dLon = futureCarto.longitude - carto.longitude;
      const dLat = futureCarto.latitude - carto.latitude;
      const targetHeading = Math.atan2(dLon * Math.cos(carto.latitude), dLat);

      // Smooth heading transition
      state.cameraHeading = lerpAngleRad(
        state.cameraHeading,
        targetHeading,
        CONFIG.chaseSmoothing
      );

      // Position camera behind the aircraft using lookAt
      // In Cesium HeadingPitchRange: heading=0 means camera is north of target
      // We want camera BEHIND the plane, so offset by π from travel direction
      const cameraHeading = state.cameraHeading + Math.PI;

      try {
        viewer.camera.lookAt(
          position,
          new Cesium.HeadingPitchRange(
            cameraHeading,
            Cesium.Math.toRadians(CONFIG.chasePitch),
            CONFIG.chaseRange
          )
        );
      } catch (e) {
        // Ignore camera errors during transitions
      }
    });
  }

  function releaseChaseCamera() {
    if (state.viewer) {
      try {
        state.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      } catch (e) {}
    }
  }

  // ============================================================
  // Cesium Initialization
  // ============================================================

  async function initCesium(token) {
    Cesium.Ion.defaultAccessToken = token;

    try {
      const viewer = new Cesium.Viewer('cesiumContainer', {
        timeline: false,
        animation: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer: document.createElement('div'),
        msaaSamples: 4,
      });

      // Add terrain asynchronously (non-blocking) - deferred to avoid init issues
      setTimeout(function () {
        Cesium.Terrain.fromWorldTerrain().then(function (terrain) {
          viewer.scene.setTerrain(terrain);
        }).catch(function () {});
      }, 2000);

      viewer.scene.globe.enableLighting = false;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.highDynamicRange = false;
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#111111');
      viewer.clock.shouldAnimate = false;
      viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;

      state.viewer = viewer;

      // Create aircraft icon
      state.aircraftIconUrl = createAircraftIcon();

      // Set up chase camera
      setupChaseCamera(viewer);

      // Set up tick listener for UI updates
      viewer.clock.onTick.addEventListener(onClockTick);

      hideLoading();

      // Helper: build UI and auto-select first flight
      function startApp() {
        buildFlightList();
        if (window.FLIGHTS.length > 0) {
          autoSelectFirstFlight();
        } else {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(27.5, -27.0, 1500000),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-60),
              roll: 0,
            },
            duration: 2,
          });
        }
      }

      // Sync new flights from FR24 then start, or just start
      if (window.FR24_SYNC) {
        window.FR24_SYNC.sync().then(startApp).catch(startApp);
      } else {
        startApp();
      }

      // Check live status (will show 'API unavailable' if CORS blocked)
      checkLiveStatus();
      setInterval(checkLiveStatus, 60000);

      return viewer;
    } catch (err) {
      console.error('Cesium init failed:', err);
      showTokenModal();
      hideLoading();
      throw err;
    }
  }

  // ============================================================
  // Flight List
  // ============================================================

  function buildFlightList() {
    const list = document.getElementById('flightList');
    list.innerHTML = '';

    window.FLIGHTS.forEach((flight, index) => {
      const item = document.createElement('div');
      item.className = 'flight-item';
      item.dataset.index = index;

      const depName = flight.departure.name.length > 18
        ? flight.departure.name.substring(0, 18) + '...'
        : flight.departure.name;
      const arrName = flight.arrival.name.length > 18
        ? flight.arrival.name.substring(0, 18) + '...'
        : flight.arrival.name;

      const depCode = flight.departure.icao || '';
      const arrCode = flight.arrival.icao || '';
      const isReturn = depName === arrName;

      item.innerHTML = `
        <div class="flight-item-header">
          <span class="flight-date">${formatDate(flight.date)}</span>
          <span class="flight-duration">${flight.duration}m</span>
        </div>
        <div class="flight-route">
          <span class="flight-icao">${depCode || depName.substring(0, 4).toUpperCase()}</span>
          <span class="flight-arrow">${isReturn ? '&#8634;' : '&#8594;'}</span>
          <span class="flight-icao">${arrCode || arrName.substring(0, 4).toUpperCase()}</span>
        </div>
        <div class="flight-names">
          ${isReturn ? depName + ' (scenic)' : depName + ' &rarr; ' + arrName}
        </div>
        <div class="flight-meta">
          <span>&#9650; ${flight.maxAlt ? flight.maxAlt.toLocaleString() + ' ft' : '-'}</span>
        </div>
      `;

      item.addEventListener('click', () => selectFlight(index));
      list.appendChild(item);

      // Staggered animation
      setTimeout(() => item.classList.add('visible'), 100 + index * 80);
    });
  }

  // ============================================================
  // Flight Selection & Rendering
  // ============================================================

  function selectFlight(index) {
    const flight = window.FLIGHTS[index];
    if (!flight || !state.viewer) return;

    // Stop live tracking if active
    if (state.liveMode) stopLiveTracking();

    // Restore HUD distance field if it was replaced by LIVE
    const hudProgressParent = document.getElementById('hudProgress')?.parentElement;
    if (hudProgressParent && !document.getElementById('hudProgress')) {
      hudProgressParent.innerHTML =
        '<span id="hudProgress">-</span><span class="hud-unit"> km</span>';
    }

    // Update selection UI
    document.querySelectorAll('.flight-item').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });

    state.currentFlightIndex = index;
    state.currentFlight = flight;
    state.isPlaying = false;

    clearFlightEntities();
    renderFlight(flight);
    updateFlightInfoPanel(flight);
    showPlaybackBar();
    updatePlayButton();

    // Show info panel
    document.getElementById('flightInfoPanel').classList.add('visible');
  }

  function clearFlightEntities() {
    state.flightEntities.forEach(e => state.viewer.entities.remove(e));
    state.flightEntities = [];
    state.aircraftEntity = null;
  }

  function renderFlight(flight) {
    const viewer = state.viewer;
    const track = flight.track;

    // Build positions and times
    const startTime = Cesium.JulianDate.fromIso8601(
      flight.date + 'T06:00:00Z'
    );
    const positions = [];
    const groundPositions = [];
    const times = [];

    const positionProperty = new Cesium.SampledPositionProperty();

    track.forEach(point => {
      const time = Cesium.JulianDate.addSeconds(
        startTime,
        point.t,
        new Cesium.JulianDate()
      );
      const altMeters = point.alt * 0.3048; // Convert feet to meters for Cesium
      const pos = Cesium.Cartesian3.fromDegrees(
        point.lng,
        point.lat,
        altMeters
      );
      const groundPos = Cesium.Cartesian3.fromDegrees(
        point.lng,
        point.lat,
        0
      );

      positionProperty.addSample(time, pos);
      positions.push(pos);
      groundPositions.push(groundPos);
      times.push(time);
    });

    // Smooth interpolation
    positionProperty.setInterpolationOptions({
      interpolationDegree: 3,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    });

    const startJulian = Cesium.JulianDate.addSeconds(
      startTime,
      track[0].t,
      new Cesium.JulianDate()
    );
    const endJulian = Cesium.JulianDate.addSeconds(
      startTime,
      track[track.length - 1].t,
      new Cesium.JulianDate()
    );

    // Set clock
    viewer.clock.startTime = startJulian.clone();
    viewer.clock.stopTime = endJulian.clone();
    viewer.clock.currentTime = startJulian.clone();
    viewer.clock.multiplier = state.speedMultiplier;
    viewer.clock.shouldAnimate = false;

    // --- Render flight path (main line at altitude) ---
    const pathEntity = viewer.entities.add({
      polyline: {
        positions: positions,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.15,
          color: Cesium.Color.fromCssColorString(CONFIG.pathColor),
        }),
        width: 4,
        clampToGround: false,
      },
    });
    state.flightEntities.push(pathEntity);

    // --- Ground shadow ---
    const shadowEntity = viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(
          track.flatMap(p => [p.lng, p.lat])
        ),
        material: Cesium.Color.fromCssColorString(CONFIG.pathColor).withAlpha(
          CONFIG.groundShadowAlpha
        ),
        width: 2,
        clampToGround: true,
      },
    });
    state.flightEntities.push(shadowEntity);

    // --- Vertical wall (altitude curtain) ---
    const wallEntity = viewer.entities.add({
      wall: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(
          track.flatMap(p => [p.lng, p.lat, p.alt * 0.3048])
        ),
        minimumHeights: track.map(() => 0),
        material: Cesium.Color.fromCssColorString(CONFIG.pathColor).withAlpha(
          CONFIG.wallAlpha
        ),
      },
    });
    state.flightEntities.push(wallEntity);

    // --- Departure marker ---
    const depMarker = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        flight.departure.lng,
        flight.departure.lat,
        track[0].alt * 0.3048
      ),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#FFD700'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE,
      },
      label: {
        text: flight.departure.icao || flight.departure.name,
        font: '13px Inter, sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    state.flightEntities.push(depMarker);

    // --- Arrival marker ---
    if (flight.departure.name !== flight.arrival.name) {
      const arrMarker = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          flight.arrival.lng,
          flight.arrival.lat,
          track[track.length - 1].alt * 0.3048
        ),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#FF8C00'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
        },
        label: {
          text: flight.arrival.icao || flight.arrival.name,
          font: '13px Inter, sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      state.flightEntities.push(arrMarker);
    }

    // --- Aircraft entity (animated with Sling TSi icon) ---
    const aircraft = viewer.entities.add({
      position: positionProperty,
      orientation: new Cesium.VelocityOrientationProperty(positionProperty),
      billboard: {
        image: state.aircraftIconUrl,
        width: 48,
        height: 48,
        rotation: new Cesium.CallbackProperty(function () {
          // Rotate billboard to match aircraft heading
          return -Cesium.Math.toRadians(state.currentHeading);
        }, false),
        alignedAxis: new Cesium.CallbackProperty(function (time) {
          // Align rotation axis to globe surface normal at aircraft position
          var pos = positionProperty.getValue(time);
          if (!pos) return Cesium.Cartesian3.UNIT_Z;
          return Cesium.Cartesian3.normalize(pos, new Cesium.Cartesian3());
        }, false),
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(500, 1.5, 50000, 0.6),
      },
      label: {
        text: flight.aircraft.registration,
        font: 'bold 13px Inter, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#FFE44D'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 3,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 50000, 0.5),
      },
      path: {
        resolution: 1,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString('#FFE44D'),
        }),
        width: CONFIG.trailWidth,
        leadTime: 0,
        trailTime: 60 * 60,
      },
    });
    state.aircraftEntity = aircraft;
    state.flightEntities.push(aircraft);

    // --- Camera: fly to show full path ---
    flyToFlightOverview(flight);

    // Draw altitude profile
    drawAltitudeProfile(flight);
  }

  // ============================================================
  // Camera
  // ============================================================

  function flyToFlightOverview(flight) {
    const viewer = state.viewer;
    const track = flight.track;

    // Calculate bounding rectangle
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    track.forEach(p => {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    const maxRange = Math.max(latRange, lngRange);

    // Calculate height based on extent (zoomed out more)
    const height = Math.max(maxRange * 111000 * 5, 25000);

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, height),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-55),
        roll: 0,
      },
      duration: 1.5,
    });
  }

  function autoSelectFirstFlight() {
    const flight = window.FLIGHTS[0];
    const track = flight.track;

    // Calculate flight center
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    track.forEach(p => {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    });
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    const maxRange = Math.max(latRange, lngRange);

    // Phase 1: Start from high orbit with dramatic angle
    state.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(centerLng - 2, centerLat - 3, 1200000),
      orientation: {
        heading: Cesium.Math.toRadians(30),
        pitch: Cesium.Math.toRadians(-25),
        roll: 0,
      },
    });

    // Phase 2: Cinematic swoop down to the flight (more zoomed out)
    setTimeout(() => {
      const height = Math.max(maxRange * 111000 * 5, 30000);
      state.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng + 0.3, centerLat - 0.2, height),
        orientation: {
          heading: Cesium.Math.toRadians(-20),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: 3.5,
        easingFunction: Cesium.EasingFunction.QUARTIC_IN_OUT,
        complete: () => {
          // Select and auto-play after camera arrives
          selectFlight(0);
          setTimeout(() => {
            play();
            // Enable chase camera (behind the plane)
            state.isFollowing = true;
            // Initialize camera heading from first track points
            const t = window.FLIGHTS[0].track;
            if (t.length >= 2) {
              const dLng = (t[1].lng - t[0].lng) * Math.cos(t[0].lat * Math.PI / 180);
              const dLat = t[1].lat - t[0].lat;
              state.cameraHeading = Math.atan2(dLng, dLat);
            }
            document.getElementById('btnFollow').classList.add('active');
          }, 800);
        },
      });
    }, 500);
  }

  function toggleFollow() {
    state.isFollowing = !state.isFollowing;
    const btn = document.getElementById('btnFollow');
    btn.classList.toggle('active', state.isFollowing);

    if (!state.isFollowing) {
      // Release chase camera lock
      releaseChaseCamera();
    }
  }

  // ============================================================
  // Playback
  // ============================================================

  function togglePlay() {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function play() {
    if (!state.viewer || !state.currentFlight) return;

    state.isPlaying = true;
    state.viewer.clock.shouldAnimate = true;
    state.viewer.clock.multiplier = state.speedMultiplier;

    updatePlayButton();
  }

  function pause() {
    if (!state.viewer) return;
    state.isPlaying = false;
    state.viewer.clock.shouldAnimate = false;
    releaseChaseCamera();
    updatePlayButton();
  }

  function restart() {
    if (!state.viewer || !state.currentFlight) return;
    state.viewer.clock.currentTime = state.viewer.clock.startTime.clone();
    play();
  }

  function setSpeed(speed) {
    state.speedMultiplier = speed;
    if (state.viewer) {
      state.viewer.clock.multiplier = speed;
    }
    document.getElementById('speedDisplay').textContent = speed + 'x';
  }

  function cycleSpeed() {
    const speeds = CONFIG.speeds;
    const currentIdx = speeds.indexOf(state.speedMultiplier);
    const nextIdx = (currentIdx + 1) % speeds.length;
    setSpeed(speeds[nextIdx]);
  }

  function updatePlayButton() {
    const btn = document.getElementById('btnPlay');
    btn.innerHTML = state.isPlaying
      ? '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>';
  }

  function showPlaybackBar() {
    document.getElementById('playbackBar').classList.add('visible');
  }

  // ============================================================
  // Clock Tick Handler (UI Updates)
  // ============================================================

  function onClockTick(clock) {
    if (!state.currentFlight || !state.aircraftEntity) return;

    const flight = state.currentFlight;
    const track = flight.track;
    const currentTime = clock.currentTime;
    const startTime = Cesium.JulianDate.fromIso8601(flight.date + 'T06:00:00Z');
    const elapsed = Cesium.JulianDate.secondsDifference(currentTime, startTime);

    // Find current track segment
    let currentPoint = track[0];
    let nextPoint = track[1];
    let progress = 0;

    for (let i = 0; i < track.length - 1; i++) {
      if (elapsed >= track[i].t && elapsed <= track[i + 1].t) {
        currentPoint = track[i];
        nextPoint = track[i + 1];
        const segFraction =
          (elapsed - track[i].t) / (track[i + 1].t - track[i].t);
        // Interpolate values
        currentPoint = {
          alt: lerp(track[i].alt, track[i + 1].alt, segFraction),
          spd: lerp(track[i].spd, track[i + 1].spd, segFraction),
          hdg: lerpAngle(track[i].hdg, track[i + 1].hdg, segFraction),
        };
        progress = (elapsed - track[0].t) / (track[track.length - 1].t - track[0].t);
        break;
      }
    }

    if (elapsed >= track[track.length - 1].t) {
      currentPoint = track[track.length - 1];
      progress = 1;
    }

    // Store current heading for billboard rotation and chase camera
    state.currentHeading = currentPoint.hdg || 0;

    // Update HUD
    updateHUD(currentPoint, progress, flight);

    // Update timeline scrubber
    updateScrubber(progress);

    // Update altitude profile marker
    updateAltitudeProfileMarker(progress);

    // Auto-stop at end
    if (progress >= 1 && state.isPlaying) {
      pause();
    }
  }

  function updateHUD(point, progress, flight) {
    const altEl = document.getElementById('hudAlt');
    const spdEl = document.getElementById('hudSpd');
    const hdgEl = document.getElementById('hudHdg');
    const progressEl = document.getElementById('hudProgress');

    if (altEl) altEl.textContent = Math.round(point.alt).toLocaleString();
    if (spdEl) spdEl.textContent = Math.round(point.spd);
    if (hdgEl) hdgEl.textContent = Math.round(point.hdg).toString().padStart(3, '0');
    if (progressEl) {
      if (flight.distance) {
        progressEl.textContent = Math.round(progress * flight.distance) + ' / ' + flight.distance;
      } else {
        progressEl.textContent = Math.round(progress * 100) + '%';
      }
    }
  }

  function updateScrubber(progress) {
    const fill = document.getElementById('scrubberFill');
    const handle = document.getElementById('scrubberHandle');
    if (fill) fill.style.width = (progress * 100) + '%';
    if (handle) handle.style.left = (progress * 100) + '%';
  }

  // ============================================================
  // Flight Info Panel
  // ============================================================

  function updateFlightInfoPanel(flight) {
    document.getElementById('infoReg').textContent = flight.aircraft.registration;
    document.getElementById('infoType').textContent = flight.aircraft.type;
    document.getElementById('infoDep').textContent =
      (flight.departure.icao ? flight.departure.icao + ' - ' : '') + flight.departure.name;
    document.getElementById('infoArr').textContent =
      (flight.arrival.icao ? flight.arrival.icao + ' - ' : '') + flight.arrival.name;
    document.getElementById('infoDate').textContent = formatDate(flight.date);
    document.getElementById('infoDist').textContent = flight.distance ? flight.distance + ' km' : '-';
    document.getElementById('infoDuration').textContent = flight.duration + ' min';
    document.getElementById('infoMaxAlt').textContent =
      flight.maxAlt ? flight.maxAlt.toLocaleString() + ' ft' : '-';
  }

  // ============================================================
  // Altitude Profile Canvas
  // ============================================================

  function drawAltitudeProfile(flight) {
    const canvas = document.getElementById('altitudeProfile');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const track = flight.track;
    const padding = { top: 8, bottom: 4, left: 2, right: 2 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Find altitude range
    let minAlt = Infinity, maxAlt = -Infinity;
    track.forEach(p => {
      minAlt = Math.min(minAlt, p.alt);
      maxAlt = Math.max(maxAlt, p.alt);
    });
    const altRange = maxAlt - minAlt || 1;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw filled area
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0.02)');

    ctx.beginPath();
    ctx.moveTo(padding.left, h - padding.bottom);

    track.forEach((p, i) => {
      const x =
        padding.left +
        ((p.t - track[0].t) / (track[track.length - 1].t - track[0].t)) * plotW;
      const y = padding.top + (1 - (p.alt - minAlt) / altRange) * plotH;
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.lineTo(padding.left + plotW, h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    track.forEach((p, i) => {
      const x =
        padding.left +
        ((p.t - track[0].t) / (track[track.length - 1].t - track[0].t)) * plotW;
      const y = padding.top + (1 - (p.alt - minAlt) / altRange) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Store for marker updates
    state.profileCanvas = canvas;
    state.profileCtx = ctx;
    state.profileData = { track, minAlt, altRange, padding, plotW, plotH, w, h };
  }

  function updateAltitudeProfileMarker(progress) {
    if (!state.profileData) return;

    const { track, minAlt, altRange, padding, plotW, plotH, w, h } =
      state.profileData;

    // Redraw the profile (simple approach)
    drawAltitudeProfile(state.currentFlight);

    const canvas = document.getElementById('altitudeProfile');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Find position at progress
    const totalTime = track[track.length - 1].t - track[0].t;
    const currentT = track[0].t + progress * totalTime;

    let alt = track[0].alt;
    for (let i = 0; i < track.length - 1; i++) {
      if (currentT >= track[i].t && currentT <= track[i + 1].t) {
        const f = (currentT - track[i].t) / (track[i + 1].t - track[i].t);
        alt = lerp(track[i].alt, track[i + 1].alt, f);
        break;
      }
    }
    if (currentT >= track[track.length - 1].t) alt = track[track.length - 1].alt;

    const x = padding.left + progress * plotW;
    const y = padding.top + (1 - (alt - minAlt) / altRange) * plotH;

    // Draw marker
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, h - padding.bottom);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#FFE44D';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // ============================================================
  // Scrubber Interaction
  // ============================================================

  function setupScrubber() {
    const scrubber = document.getElementById('scrubberTrack');
    if (!scrubber) return;

    let isDragging = false;

    function seekToPosition(e) {
      const rect = scrubber.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      if (state.viewer && state.currentFlight) {
        const start = state.viewer.clock.startTime;
        const stop = state.viewer.clock.stopTime;
        const duration = Cesium.JulianDate.secondsDifference(stop, start);
        const newTime = Cesium.JulianDate.addSeconds(
          start,
          fraction * duration,
          new Cesium.JulianDate()
        );
        state.viewer.clock.currentTime = newTime;
      }
    }

    scrubber.addEventListener('mousedown', e => {
      isDragging = true;
      seekToPosition(e);
    });

    document.addEventListener('mousemove', e => {
      if (isDragging) seekToPosition(e);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  function setupEventListeners() {
    // Token submit
    document.getElementById('tokenSubmit').addEventListener('click', () => {
      const token = document.getElementById('tokenInput').value.trim();
      if (token) {
        saveToken(token);
        hideTokenModal();
        showLoading();
        initCesium(token);
      }
    });

    document.getElementById('tokenInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('tokenSubmit').click();
    });

    // Playback controls
    document.getElementById('btnPlay').addEventListener('click', togglePlay);
    document.getElementById('btnRestart').addEventListener('click', restart);
    document.getElementById('btnSpeed').addEventListener('click', cycleSpeed);
    document.getElementById('btnFollow').addEventListener('click', toggleFollow);

    // Prev/Next flight
    document.getElementById('btnPrev').addEventListener('click', () => {
      if (state.currentFlightIndex > 0) {
        selectFlight(state.currentFlightIndex - 1);
      }
    });

    document.getElementById('btnNext').addEventListener('click', () => {
      if (state.currentFlightIndex < window.FLIGHTS.length - 1) {
        selectFlight(state.currentFlightIndex + 1);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'r':
          restart();
          break;
        case 's':
          cycleSpeed();
          break;
        case 'f':
          toggleFollow();
          break;
        case 'ArrowLeft':
          if (state.currentFlightIndex > 0)
            selectFlight(state.currentFlightIndex - 1);
          break;
        case 'ArrowRight':
          if (state.currentFlightIndex < window.FLIGHTS.length - 1)
            selectFlight(state.currentFlightIndex + 1);
          break;
        case 'Escape':
          state.isFollowing = false;
          releaseChaseCamera();
          document.getElementById('btnFollow').classList.remove('active');
          break;
      }
    });

    // Scrubber
    setupScrubber();

    // Window resize: redraw profile
    window.addEventListener('resize', () => {
      if (state.currentFlight) drawAltitudeProfile(state.currentFlight);
    });
  }

  // ============================================================
  // Utility Functions
  // ============================================================

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpAngle(a, b, t) {
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return ((a + diff * t) + 360) % 360;
  }

  function lerpAngleRad(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function showLoading() {
    document.getElementById('loadingScreen').classList.add('visible');
  }

  function hideLoading() {
    document.getElementById('loadingScreen').classList.remove('visible');
  }

  // ============================================================
  // Live Tracking (adsb.lol)
  // ============================================================

  async function checkLiveStatus() {
    const cfg = window.LIVE_TRACKING;
    if (!cfg || !cfg.enabled) return;

    const statusEl = document.getElementById('liveStatus');
    const dotEl = document.getElementById('liveDot');
    const textEl = document.getElementById('liveText');

    try {
      const res = await fetch(cfg.apiBase + '/reg/' + cfg.registration);
      const data = await res.json();

      if (data.ac && data.ac.length > 0) {
        const ac = data.ac[0];
        dotEl.className = 'live-dot online';
        const alt = ac.alt_baro || ac.alt_geom || '?';
        const spd = ac.gs ? Math.round(ac.gs) : '?';
        textEl.textContent = 'LIVE - ' + alt + 'ft / ' + spd + 'kt';

        // Add track button if not already there
        if (!statusEl.querySelector('.live-track-btn')) {
          const btn = document.createElement('button');
          btn.className = 'live-track-btn';
          btn.textContent = 'Track Live';
          btn.addEventListener('click', () => startLiveTracking());
          statusEl.appendChild(btn);
        }

        state.liveLastData = ac;
      } else {
        dotEl.className = 'live-dot offline';
        textEl.textContent = 'ZU-WBG not airborne';
        state.liveLastData = null;

        // Remove track button if exists
        const btn = statusEl.querySelector('.live-track-btn');
        if (btn) btn.remove();
      }
    } catch (e) {
      dotEl.className = 'live-dot offline';
      textEl.textContent = 'API unavailable';
    }
  }

  function startLiveTracking() {
    if (!state.viewer) return;

    state.liveMode = true;
    clearFlightEntities();
    stopLiveTracking();

    // Deselect any flight
    document.querySelectorAll('.flight-item').forEach(el => el.classList.remove('selected'));
    state.currentFlightIndex = -1;
    state.currentFlight = null;
    document.getElementById('flightInfoPanel').classList.remove('visible');
    document.getElementById('playbackBar').classList.remove('visible');

    // Update HUD for live
    document.getElementById('hudAlt').textContent = '-';
    document.getElementById('hudSpd').textContent = '-';
    document.getElementById('hudHdg').textContent = '-';
    document.getElementById('hudProgress').parentElement.innerHTML =
      '<span style="font-size:12px;color:var(--accent-bright);">LIVE</span>';

    state.liveTrailPositions = [];

    // Start polling
    pollLivePosition();
    state.livePollTimer = setInterval(pollLivePosition, window.LIVE_TRACKING.pollInterval);
  }

  function stopLiveTracking() {
    if (state.livePollTimer) {
      clearInterval(state.livePollTimer);
      state.livePollTimer = null;
    }
    if (state.liveEntity) {
      state.viewer.entities.remove(state.liveEntity);
      state.liveEntity = null;
    }
    if (state.liveTrailEntity) {
      state.viewer.entities.remove(state.liveTrailEntity);
      state.liveTrailEntity = null;
    }
    state.liveMode = false;
  }

  async function pollLivePosition() {
    const cfg = window.LIVE_TRACKING;
    try {
      const res = await fetch(cfg.apiBase + '/reg/' + cfg.registration);
      const data = await res.json();

      if (!data.ac || data.ac.length === 0) {
        // Aircraft went offline
        const dotEl = document.getElementById('liveDot');
        const textEl = document.getElementById('liveText');
        dotEl.className = 'live-dot offline';
        textEl.textContent = 'ZU-WBG signal lost';
        return;
      }

      const ac = data.ac[0];
      state.liveLastData = ac;

      const lat = ac.lat;
      const lng = ac.lon;
      const altFeet = ac.alt_baro === 'ground' ? 0 : (ac.alt_baro || ac.alt_geom || 0);
      const altMeters = typeof altFeet === 'number' ? altFeet * 0.3048 : 0;
      const spd = ac.gs || 0;
      const hdg = ac.track || ac.true_heading || 0;

      // Update HUD
      document.getElementById('hudAlt').textContent = Math.round(altMeters).toLocaleString();
      document.getElementById('hudSpd').textContent = Math.round(spd);
      document.getElementById('hudHdg').textContent = Math.round(hdg).toString().padStart(3, '0');

      // Update live status
      const dotEl = document.getElementById('liveDot');
      const textEl = document.getElementById('liveText');
      dotEl.className = 'live-dot online';
      textEl.textContent = 'LIVE - ' + Math.round(altFeet) + 'ft / ' + Math.round(spd) + 'kt';

      const pos = Cesium.Cartesian3.fromDegrees(lng, lat, altMeters);

      // Add to trail
      state.liveTrailPositions.push(pos);

      // Update or create aircraft entity
      if (!state.liveEntity) {
        state.liveEntity = state.viewer.entities.add({
          position: pos,
          point: {
            pixelSize: 16,
            color: Cesium.Color.fromCssColorString('#FFE44D'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: cfg.registration + ' (LIVE)',
            font: 'bold 14px Inter, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#FFE44D'),
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 3,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        // Fly to aircraft
        state.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lng, lat, Math.max(altMeters * 5, 20000)),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 2,
        });
      } else {
        state.liveEntity.position = pos;
      }

      // Update trail line
      if (state.liveTrailPositions.length >= 2) {
        if (state.liveTrailEntity) {
          state.viewer.entities.remove(state.liveTrailEntity);
        }
        state.liveTrailEntity = state.viewer.entities.add({
          polyline: {
            positions: state.liveTrailPositions.slice(),
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.15,
              color: Cesium.Color.fromCssColorString('#FFD700'),
            }),
            width: 4,
            clampToGround: false,
          },
        });
      }
    } catch (e) {
      console.error('Live poll error:', e);
    }
  }

  // ============================================================
  // Initialization
  // ============================================================

  function init() {
    setupEventListeners();

    // Priority: localStorage > config.js > prompt user
    const token = getToken() || window.CESIUM_ION_TOKEN || null;
    if (token) {
      saveToken(token); // persist for future loads
      showLoading();
      initCesium(token).catch(function (err) {
        console.error('initCesium failed:', err);
      });
    } else {
      showTokenModal();
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
