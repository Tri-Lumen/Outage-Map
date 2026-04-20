// Map outlines used by OutageMapView. World land and US state regions are
// loaded from a pre-simplified Natural Earth snapshot (mapData.geo.json);
// regenerate via `node scripts/build-mapdata.mjs`.
//
// Each shape is a MultiPolygon — an array of outer rings, each ring a list of
// [longitude, latitude] points in degrees. Holes are dropped for simplicity.

import geoData from './mapData.geo.json';

export type LonLat = readonly [number, number];

export interface LandShape {
  id: string;
  name: string;
  polygons: readonly (readonly LonLat[])[];
}

export interface Region {
  id: string;
  name: string;
  short: string;
  /** geographic center in longitude/latitude */
  center: LonLat;
  /** relative population weight, used to scale per-region report share */
  population: number;
  /** scope: which map view this region appears in */
  scope: 'global' | 'na';
}

export interface USRegionShape {
  id: string;
  name: string;
  short: string;
  polygons: readonly (readonly LonLat[])[];
  hub: LonLat;
  population: number;
}

// ---------- Projections ----------

export const WORLD_VIEWBOX = { w: 960, h: 480 };
export const NA_VIEWBOX = { w: 960, h: 500 };

// Equirectangular projection covering the whole globe.
export function projectWorld([lon, lat]: LonLat): [number, number] {
  const x = ((lon + 180) * WORLD_VIEWBOX.w) / 360;
  const y = ((90 - lat) * WORLD_VIEWBOX.h) / 180;
  return [x, y];
}

// Flat projection focused on the contiguous US + a sliver of Canada/Mexico.
// Lon range: -125..-65 (60° wide). Lat range: 24..50 (26° tall).
export function projectNA([lon, lat]: LonLat): [number, number] {
  const x = ((lon + 125) * NA_VIEWBOX.w) / 60;
  const y = ((50 - lat) * NA_VIEWBOX.h) / 26;
  return [x, y];
}

export function toPath(
  polygons: readonly (readonly LonLat[])[],
  project: (p: LonLat) => [number, number],
): string {
  const parts: string[] = [];
  for (const ring of polygons) {
    if (ring.length === 0) continue;
    const [x0, y0] = project(ring[0]);
    let d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
    for (let i = 1; i < ring.length; i++) {
      const [x, y] = project(ring[i]);
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    d += ' Z';
    parts.push(d);
  }
  return parts.join(' ');
}

// ---------- World land masses ----------

interface RawShape {
  id: string;
  name: string;
  polygons: number[][][];
}
interface RawRegion extends RawShape {
  short: string;
}
interface RawGeo {
  world: RawShape[];
  usOutline: RawShape;
  usRegions: RawRegion[];
}

const RAW: RawGeo = geoData as unknown as RawGeo;

function toLonLatRings(polys: number[][][]): readonly (readonly LonLat[])[] {
  return polys.map((ring) => ring.map((p) => [p[0], p[1]] as LonLat));
}

export const WORLD_LAND_SHAPES: LandShape[] = RAW.world.map((s) => ({
  id: s.id,
  name: s.name,
  polygons: toLonLatRings(s.polygons),
}));

// ---------- Regions (heatmap data points) ----------

export const WORLD_REGIONS: Region[] = [
  { id: 'na-w', name: 'North America · West', short: 'NA-West', center: [-120, 40], population: 0.10, scope: 'global' },
  { id: 'na-e', name: 'North America · East', short: 'NA-East', center: [-78, 40], population: 0.14, scope: 'global' },
  { id: 'sa', name: 'South America', short: 'SA', center: [-58, -15], population: 0.08, scope: 'global' },
  { id: 'eu-w', name: 'Europe · West', short: 'EU-West', center: [4, 48], population: 0.17, scope: 'global' },
  { id: 'eu-e', name: 'Europe · East', short: 'EU-East', center: [30, 52], population: 0.07, scope: 'global' },
  { id: 'af', name: 'Africa', short: 'AF', center: [22, 5], population: 0.06, scope: 'global' },
  { id: 'me', name: 'Middle East', short: 'ME', center: [45, 28], population: 0.05, scope: 'global' },
  { id: 'as-s', name: 'South Asia', short: 'AS-South', center: [78, 22], population: 0.08, scope: 'global' },
  { id: 'as-se', name: 'Southeast Asia', short: 'AS-SE', center: [110, 5], population: 0.05, scope: 'global' },
  { id: 'as-e', name: 'East Asia', short: 'AS-East', center: [118, 35], population: 0.12, scope: 'global' },
  { id: 'oc', name: 'Oceania', short: 'OC', center: [135, -25], population: 0.03, scope: 'global' },
];

// ---------- USA + regional subdivisions ----------

// Per-region hubs and population weights. Polygon data comes from the JSON.
const US_REGION_META: Record<string, { hub: LonLat; population: number }> = {
  'us-west':    { hub: [-120, 39], population: 0.22 },
  'us-central': { hub: [-95, 42],  population: 0.24 },
  'us-south':   { hub: [-92, 32],  population: 0.32 },
  'us-east':    { hub: [-77, 40],  population: 0.22 },
};

export const US_OUTLINE_SHAPE: LandShape = {
  id: RAW.usOutline.id,
  name: RAW.usOutline.name,
  polygons: toLonLatRings(RAW.usOutline.polygons),
};

export const US_REGION_SHAPES: USRegionShape[] = RAW.usRegions.map((r) => {
  const meta = US_REGION_META[r.id];
  if (!meta) throw new Error(`Unknown US region id ${r.id}`);
  return {
    id: r.id,
    name: r.name,
    short: r.short,
    polygons: toLonLatRings(r.polygons),
    hub: meta.hub,
    population: meta.population,
  };
});
