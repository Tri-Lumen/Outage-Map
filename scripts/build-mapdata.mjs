#!/usr/bin/env node
// Regenerates src/lib/mapData.geo.json from Natural Earth GeoJSON.
// Run: node scripts/build-mapdata.mjs
// Requires network access to raw.githubusercontent.com.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'mapData.geo.json');

const SOURCES = {
  countries: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  states: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',
};

const US_REGIONS = {
  west: ['WA', 'OR', 'CA', 'NV', 'ID', 'MT', 'WY', 'UT', 'CO', 'AZ', 'NM', 'AK', 'HI'],
  central: ['ND', 'SD', 'NE', 'KS', 'MN', 'IA', 'MO', 'WI', 'IL', 'IN', 'MI', 'OH'],
  south: ['TX', 'OK', 'AR', 'LA', 'MS', 'AL', 'TN', 'KY', 'GA', 'FL', 'SC', 'NC', 'VA', 'WV'],
  east: ['PA', 'NY', 'NJ', 'DE', 'MD', 'DC', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME'],
};

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// Ramer–Douglas–Peucker simplification. Tolerance is in degrees.
function rdp(points, tolerance) {
  if (points.length < 3) return points;
  const sqTol = tolerance * tolerance;

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxSqDist = 0;
    let maxIdx = -1;
    const [x1, y1] = points[start];
    const [x2, y2] = points[end];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLenSq = dx * dx + dy * dy || 1e-12;

    for (let i = start + 1; i < end; i++) {
      const [px, py] = points[i];
      const t = ((px - x1) * dx + (py - y1) * dy) / segLenSq;
      const cx = x1 + t * dx;
      const cy = y1 + t * dy;
      const ex = px - cx;
      const ey = py - cy;
      const d = ex * ex + ey * ey;
      if (d > maxSqDist) {
        maxSqDist = d;
        maxIdx = i;
      }
    }

    if (maxSqDist > sqTol && maxIdx !== -1) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function roundPt([lon, lat]) {
  return [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100];
}

function simplifyRing(ring, tolerance) {
  const simplified = rdp(ring, tolerance).map(roundPt);
  if (simplified.length < 4) return null;
  return simplified;
}

// Extract outer rings only (ignore holes — visual only).
function extractPolygons(geometry, tolerance) {
  const polys = [];
  if (geometry.type === 'Polygon') {
    const outer = simplifyRing(geometry.coordinates[0], tolerance);
    if (outer) polys.push(outer);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      const outer = simplifyRing(poly[0], tolerance);
      if (outer) polys.push(outer);
    }
  }
  return polys;
}

function countryId(props) {
  const code = props.ISO_A3 || props.ADM0_A3 || props.ADM0_A3_US || props.NAME;
  return String(code).toLowerCase();
}

async function main() {
  console.log('Downloading Natural Earth sources…');
  const [countriesGeo, statesGeo] = await Promise.all([
    getJson(SOURCES.countries),
    getJson(SOURCES.states),
  ]);

  // World: every country as one LandShape (MultiPolygon flattened to multiple rings).
  // Skip Antarctica to keep the viewBox clean.
  const world = [];
  for (const f of countriesGeo.features) {
    if (f.properties.ADM0_A3 === 'ATA') continue; // Antarctica
    const polys = extractPolygons(f.geometry, 0.8);
    if (polys.length === 0) continue;
    world.push({
      id: countryId(f.properties),
      name: f.properties.NAME || f.properties.ADMIN || 'Unknown',
      polygons: polys,
    });
  }

  // US: group states into regions. Also keep a full us-outline by unioning every state ring.
  const stateToRegion = {};
  for (const [region, states] of Object.entries(US_REGIONS)) {
    for (const s of states) stateToRegion[s] = region;
  }

  const regionPolys = { west: [], central: [], south: [], east: [] };
  const usOutlinePolys = [];

  for (const f of statesGeo.features) {
    if (f.properties.adm0_a3 !== 'USA') continue;
    const postal = f.properties.postal;
    // Exclude AK/HI from the contiguous NA outline (they're outside NA_VIEWBOX lon/lat range).
    const contiguous = postal !== 'AK' && postal !== 'HI';
    const polys = extractPolygons(f.geometry, 0.25);
    if (polys.length === 0) continue;
    const region = stateToRegion[postal];
    if (region && contiguous) {
      regionPolys[region].push(...polys);
      usOutlinePolys.push(...polys);
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'Natural Earth (ne_110m_admin_0_countries, ne_50m_admin_1_states_provinces)',
    world,
    usOutline: { id: 'us-outline', name: 'Contiguous United States', polygons: usOutlinePolys },
    usRegions: [
      { id: 'us-west',    name: 'US West',    short: 'us-west',    polygons: regionPolys.west },
      { id: 'us-central', name: 'US Central', short: 'us-central', polygons: regionPolys.central },
      { id: 'us-south',   name: 'US South',   short: 'us-south',   polygons: regionPolys.south },
      { id: 'us-east',    name: 'US East',    short: 'us-east',    polygons: regionPolys.east },
    ],
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output));
  const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`Wrote ${OUT_PATH} (${sizeKb} KB)`);
  console.log(`  countries: ${world.length}, US region rings: ${
    Object.values(regionPolys).reduce((n, r) => n + r.length, 0)
  }`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
