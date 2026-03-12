#!/usr/bin/env node
// Generate a low-poly Sling TSi 916 aircraft GLB model
// Outputs a binary .glb file with gold-colored geometry
// The model faces +Y (north) with wings along X axis

const fs = require('fs');
const path = require('path');

// ── Geometry helpers ──────────────────────────────────────────
function vec3(x, y, z) { return [x, y, z]; }

function computeNormal(a, b, c) {
  const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  const n = [
    u[1]*v[2] - u[2]*v[1],
    u[2]*v[0] - u[0]*v[2],
    u[0]*v[1] - u[1]*v[0],
  ];
  const len = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]) || 1;
  return [n[0]/len, n[1]/len, n[2]/len];
}

// Build aircraft geometry as triangles
// Coordinate system: X = right wing, Y = forward (nose), Z = up
// Scale: roughly 8m wingspan, 7m length (Sling TSi proportions)
function buildAircraftMesh() {
  const verts = [];
  const normals = [];

  function addTri(a, b, c) {
    const n = computeNormal(a, b, c);
    verts.push(...a, ...b, ...c);
    normals.push(...n, ...n, ...n);
  }

  function addQuad(a, b, c, d) {
    addTri(a, b, c);
    addTri(a, c, d);
  }

  // Mirror a set of quads across X axis
  function mirrorX(fn) {
    fn(1);   // right side
    fn(-1);  // left side (mirrored)
  }

  // ── Fuselage ────────────────────────────────────────────────
  // Cross-section at various Y stations (front to back)
  // Sling TSi has a rounded fuselage, ~1.2m wide, ~1.3m tall
  const fw = 0.6;  // fuselage half-width
  const fh = 0.65; // fuselage half-height

  // Fuselage stations (Y coordinate, width-scale, height-scale)
  const stations = [
    { y: 3.5,  ws: 0.0, hs: 0.0 },   // nose tip (spinner)
    { y: 3.2,  ws: 0.3, hs: 0.35 },   // cowling front
    { y: 2.8,  ws: 0.55, hs: 0.6 },   // cowling mid
    { y: 2.2,  ws: 0.8, hs: 0.85 },   // windshield base
    { y: 1.5,  ws: 1.0, hs: 1.0 },    // cabin (widest)
    { y: 0.5,  ws: 1.0, hs: 1.0 },    // mid cabin
    { y: -0.5, ws: 0.85, hs: 0.9 },   // behind cabin
    { y: -1.5, ws: 0.6, hs: 0.7 },    // rear fuselage
    { y: -2.5, ws: 0.35, hs: 0.45 },  // tail cone
    { y: -3.2, ws: 0.15, hs: 0.25 },  // tail tip
  ];

  // Build fuselage as octagonal cross-sections
  const numSides = 8;
  function stationRing(s) {
    const pts = [];
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      pts.push(vec3(
        Math.cos(angle) * fw * s.ws,
        s.y,
        Math.sin(angle) * fh * s.hs + fh * s.hs * 0.1 // slight upward bias
      ));
    }
    return pts;
  }

  const rings = stations.map(stationRing);

  // Connect adjacent rings
  for (let r = 0; r < rings.length - 1; r++) {
    const r1 = rings[r];
    const r2 = rings[r + 1];
    if (r1.length === 0 || r2.length === 0) continue;

    for (let i = 0; i < numSides; i++) {
      const j = (i + 1) % numSides;
      // Handle nose/tail where ring collapses to a point
      if (stations[r+1].ws < 0.05) {
        // Triangle to tip
        addTri(r1[i], r1[j], vec3(0, stations[r+1].y, fh * stations[r+1].hs * 0.1));
      } else if (stations[r].ws < 0.05) {
        addTri(vec3(0, stations[r].y, fh * stations[r].hs * 0.1), r2[j], r2[i]);
      } else {
        addQuad(r1[i], r1[j], r2[j], r2[i]);
      }
    }
  }

  // ── Wings ───────────────────────────────────────────────────
  // Sling TSi: low-wing, straight, slight taper
  // Wingspan ~9.5m, chord root ~1.4m, chord tip ~0.9m
  const wingSpan = 4.5; // half-span
  const rootChord = 1.4;
  const tipChord = 0.9;
  const wingThickRoot = 0.14; // thickness ratio
  const wingThickTip = 0.10;
  const wingY = 0.8; // wing root Y position (slightly forward of CG)
  const wingZ = -0.15; // low-wing mounting
  const dihedral = 0.15; // slight upward angle

  mirrorX(side => {
    const tipX = side * wingSpan;
    const rootX = side * fw * 0.9;
    const tipZ = wingZ + dihedral;

    // Wing airfoil: simple diamond shape
    const rLE = vec3(rootX, wingY + rootChord * 0.4, wingZ);
    const rTE = vec3(rootX, wingY - rootChord * 0.6, wingZ);
    const rTop = vec3(rootX, wingY + rootChord * 0.1, wingZ + rootChord * wingThickRoot);
    const rBot = vec3(rootX, wingY + rootChord * 0.1, wingZ - rootChord * wingThickRoot);

    const tLE = vec3(tipX, wingY + tipChord * 0.3, tipZ);
    const tTE = vec3(tipX, wingY - tipChord * 0.7, tipZ);
    const tTop = vec3(tipX, wingY + tipChord * 0.05, tipZ + tipChord * wingThickTip);
    const tBot = vec3(tipX, wingY + tipChord * 0.05, tipZ - tipChord * wingThickTip);

    // Top surface
    addQuad(rLE, tLE, tTop, rTop);
    addQuad(rTop, tTop, tTE, rTE);
    // Bottom surface
    addQuad(rLE, rBot, tBot, tLE);
    addQuad(rBot, rTE, tTE, tBot);
    // Tip cap
    addQuad(tLE, tTop, tTE, tBot);
  });

  // ── Horizontal Stabilizer ───────────────────────────────────
  const hStabSpan = 1.8;
  const hStabChord = 0.8;
  const hStabThick = 0.06;
  const hStabY = -2.8;
  const hStabZ = 0.3;

  mirrorX(side => {
    const tipX = side * hStabSpan;
    const rootX = side * 0.12;

    const rLE = vec3(rootX, hStabY + hStabChord * 0.4, hStabZ);
    const rTE = vec3(rootX, hStabY - hStabChord * 0.6, hStabZ);
    const tLE = vec3(tipX, hStabY + hStabChord * 0.25, hStabZ);
    const tTE = vec3(tipX, hStabY - hStabChord * 0.5, hStabZ);
    const rT = vec3(rootX, hStabY, hStabZ + hStabChord * hStabThick);
    const tT = vec3(tipX, hStabY, hStabZ + hStabChord * hStabThick);
    const rB = vec3(rootX, hStabY, hStabZ - hStabChord * hStabThick);
    const tB = vec3(tipX, hStabY, hStabZ - hStabChord * hStabThick);

    addQuad(rLE, tLE, tT, rT);
    addQuad(rT, tT, tTE, rTE);
    addQuad(rLE, rB, tB, tLE);
    addQuad(rB, rTE, tTE, tB);
  });

  // ── Vertical Stabilizer (Fin) ───────────────────────────────
  const vStabHeight = 1.2;
  const vStabChord = 1.0;
  const vStabThick = 0.05;
  const vStabY = -2.6;

  const vBase_LE = vec3(0, vStabY + vStabChord * 0.4, hStabZ);
  const vBase_TE = vec3(0, vStabY - vStabChord * 0.6, hStabZ);
  const vTop_LE = vec3(0, vStabY + vStabChord * 0.15, hStabZ + vStabHeight);
  const vTop_TE = vec3(0, vStabY - vStabChord * 0.35, hStabZ + vStabHeight);

  // Right side
  const vbR = vec3(vStabThick, vStabY, hStabZ + 0.1);
  const vtR = vec3(vStabThick * 0.5, vStabY, hStabZ + vStabHeight);
  addTri(vBase_LE, vbR, vTop_LE);
  addTri(vbR, vtR, vTop_LE);
  addTri(vbR, vBase_TE, vTop_TE);
  addTri(vbR, vTop_TE, vtR);

  // Left side
  const vbL = vec3(-vStabThick, vStabY, hStabZ + 0.1);
  const vtL = vec3(-vStabThick * 0.5, vStabY, hStabZ + vStabHeight);
  addTri(vBase_LE, vTop_LE, vbL);
  addTri(vbL, vTop_LE, vtL);
  addTri(vbL, vTop_TE, vBase_TE);
  addTri(vbL, vtL, vTop_TE);

  // ── Propeller ───────────────────────────────────────────────
  // Simple two-blade prop disc
  const propY = 3.55;
  const propR = 0.9;
  const propW = 0.08;

  // Blade 1 (horizontal)
  addQuad(
    vec3(-propR, propY, propW), vec3(propR, propY, propW),
    vec3(propR, propY, -propW), vec3(-propR, propY, -propW)
  );
  // Blade 2 (vertical)
  addQuad(
    vec3(-propW, propY, -propR), vec3(propW, propY, -propR),
    vec3(propW, propY, propR), vec3(-propW, propY, propR)
  );

  // Spinner cone
  const spinPts = 6;
  for (let i = 0; i < spinPts; i++) {
    const a1 = (i / spinPts) * Math.PI * 2;
    const a2 = ((i+1) / spinPts) * Math.PI * 2;
    const r = 0.12;
    addTri(
      vec3(0, 3.6, 0),
      vec3(Math.cos(a1)*r, 3.45, Math.sin(a1)*r),
      vec3(Math.cos(a2)*r, 3.45, Math.sin(a2)*r)
    );
  }

  return { verts: new Float32Array(verts), normals: new Float32Array(normals) };
}

// ── GLB Builder ───────────────────────────────────────────────
function buildGLB(mesh) {
  const { verts, normals } = mesh;
  const vertCount = verts.length / 3;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < verts.length; i += 3) {
    minX = Math.min(minX, verts[i]);
    minY = Math.min(minY, verts[i+1]);
    minZ = Math.min(minZ, verts[i+2]);
    maxX = Math.max(maxX, verts[i]);
    maxY = Math.max(maxY, verts[i+1]);
    maxZ = Math.max(maxZ, verts[i+2]);
  }

  // Binary buffer: verts + normals (both Float32)
  const bufferByteLength = verts.byteLength + normals.byteLength;
  const binBuffer = Buffer.alloc(bufferByteLength);
  Buffer.from(verts.buffer).copy(binBuffer, 0);
  Buffer.from(normals.buffer).copy(binBuffer, verts.byteLength);

  // Pad to 4-byte alignment
  const padding = (4 - (bufferByteLength % 4)) % 4;
  const paddedBin = Buffer.concat([binBuffer, Buffer.alloc(padding, 0x20)]);

  // Gold metallic color: RGB(1.0, 0.85, 0.0)
  const gltf = {
    asset: { version: "2.0", generator: "WagyuWings FlightTracker" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    // Rotate model so nose faces +X (Cesium's forward for VelocityOrientationProperty)
    // Our geometry has nose along +Y, so rotate -90° around Z
    // Quaternion for -90° around Z: [0, 0, -sin(45°), cos(45°)] = [0, 0, -0.7071, 0.7071]
    nodes: [{ mesh: 0, name: "SlingTSi", rotation: [0, 0, -0.7071068, 0.7071068] }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        material: 0,
      }]
    }],
    materials: [{
      name: "GoldMetal",
      pbrMetallicRoughness: {
        baseColorFactor: [1.0, 0.9, 0.0, 1.0],
        metallicFactor: 0.7,
        roughnessFactor: 0.35,
      },
      emissiveFactor: [0.15, 0.13, 0.0],
      doubleSided: true,
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: vertCount,
        type: "VEC3",
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: vertCount,
        type: "VEC3",
      }
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: verts.byteLength,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: verts.byteLength,
        byteLength: normals.byteLength,
        target: 34962,
      }
    ],
    buffers: [{
      byteLength: bufferByteLength,
    }],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonPadding = (4 - (jsonStr.length % 4)) % 4;
  const jsonChunk = Buffer.from(jsonStr + ' '.repeat(jsonPadding), 'utf8');

  // GLB structure: header(12) + JSON chunk(8+data) + BIN chunk(8+data)
  const totalLength = 12 + 8 + jsonChunk.length + 8 + paddedBin.length;

  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  // Header
  glb.writeUInt32LE(0x46546C67, offset); offset += 4; // magic "glTF"
  glb.writeUInt32LE(2, offset); offset += 4;           // version
  glb.writeUInt32LE(totalLength, offset); offset += 4;

  // JSON chunk
  glb.writeUInt32LE(jsonChunk.length, offset); offset += 4;
  glb.writeUInt32LE(0x4E4F534A, offset); offset += 4; // "JSON"
  jsonChunk.copy(glb, offset); offset += jsonChunk.length;

  // BIN chunk
  glb.writeUInt32LE(paddedBin.length, offset); offset += 4;
  glb.writeUInt32LE(0x004E4942, offset); offset += 4; // "BIN\0"
  paddedBin.copy(glb, offset);

  return glb;
}

// ── Main ──────────────────────────────────────────────────────
const mesh = buildAircraftMesh();
const glb = buildGLB(mesh);
const outPath = path.join(__dirname, '..', 'models', 'sling-tsi.glb');
fs.writeFileSync(outPath, glb);
console.log(`Written ${glb.length} bytes to ${outPath}`);
console.log(`Vertices: ${mesh.verts.length / 3}`);
