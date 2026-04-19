// Hand-crafted simplified land-mass outlines used by OutageMapView.
// Coordinates are [longitude, latitude] in degrees. A projection helper
// converts them to the viewBox used by the SVG. These approximate real
// land masses closely enough for a dashboard-scale heatmap while keeping
// the source readable and dependency-free.

export type LonLat = readonly [number, number];

export interface LandShape {
  id: string;
  name: string;
  points: readonly LonLat[];
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
  points: readonly LonLat[];
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
  points: readonly LonLat[],
  project: (p: LonLat) => [number, number],
): string {
  if (points.length === 0) return '';
  const [x0, y0] = project(points[0]);
  let d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = project(points[i]);
    d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + ' Z';
}

// ---------- World land masses ----------
//
// Outlines are intentionally coarse but silhouettes are recognizable. Each
// point is chosen on the real coastline. Polygons close back to the first
// point.

const NORTH_AMERICA: LonLat[] = [
  [-168, 66], [-162, 67], [-156, 71], [-140, 70], [-125, 70], [-110, 72],
  [-95, 74], [-80, 73], [-68, 68], [-56, 62], [-55, 52], [-60, 46],
  [-66, 45], [-70, 43], [-74, 40], [-76, 37], [-80, 32], [-81, 25],
  [-80, 25], [-83, 28], [-87, 30], [-90, 29], [-94, 29], [-97, 26],
  [-97, 22], [-95, 18], [-90, 16], [-85, 15], [-84, 10], [-79, 8],
  [-83, 10], [-87, 13], [-92, 15], [-95, 16], [-97, 16], [-100, 17],
  [-105, 20], [-110, 23], [-114, 29], [-117, 32], [-120, 34], [-123, 38],
  [-124, 43], [-125, 48], [-130, 54], [-134, 58], [-140, 60], [-148, 60],
  [-152, 58], [-158, 57], [-162, 54], [-167, 54], [-163, 58], [-158, 61],
  [-162, 63], [-165, 64], [-168, 66],
];

const GREENLAND: LonLat[] = [
  [-55, 60], [-48, 60], [-42, 62], [-36, 65], [-28, 68], [-22, 70],
  [-20, 74], [-18, 78], [-22, 82], [-36, 83], [-55, 83], [-68, 81],
  [-72, 78], [-66, 74], [-58, 70], [-52, 66], [-55, 60],
];

const SOUTH_AMERICA: LonLat[] = [
  [-80, 12], [-75, 11], [-66, 11], [-60, 8], [-52, 5], [-50, 0],
  [-47, -2], [-43, -5], [-38, -8], [-36, -12], [-38, -18], [-40, -22],
  [-45, -24], [-48, -28], [-54, -34], [-58, -38], [-62, -40], [-65, -44],
  [-68, -48], [-70, -52], [-74, -53], [-73, -45], [-74, -40], [-73, -36],
  [-71, -30], [-70, -22], [-71, -17], [-74, -10], [-78, -6], [-81, -4],
  [-81, 0], [-79, 2], [-78, 7], [-80, 12],
];

const EUROPE: LonLat[] = [
  [-10, 36], [-9, 39], [-9, 43], [-4, 44], [-2, 48], [-4, 49],
  [2, 51], [4, 53], [7, 54], [8, 56], [6, 58], [10, 59], [12, 64],
  [15, 66], [22, 70], [28, 71], [40, 69], [44, 66], [45, 60], [35, 58],
  [38, 54], [40, 48], [40, 44], [30, 41], [26, 40], [24, 38], [20, 40],
  [18, 40], [15, 38], [12, 37], [10, 43], [8, 44], [4, 43], [0, 42],
  [-4, 37], [-10, 36],
];

const UK: LonLat[] = [
  [-5, 50], [-3, 51], [1, 51], [1, 53], [0, 54], [-1, 55], [-2, 57],
  [-5, 58], [-6, 57], [-5, 54], [-5, 52], [-5, 50],
];

const IRELAND: LonLat[] = [
  [-10, 52], [-7, 55], [-6, 54], [-6, 52], [-10, 52],
];

const ICELAND: LonLat[] = [
  [-24, 64], [-14, 64], [-14, 66], [-18, 66], [-24, 66], [-24, 64],
];

const AFRICA: LonLat[] = [
  [-17, 21], [-17, 14], [-14, 12], [-13, 8], [-8, 5], [-2, 5],
  [3, 6], [8, 4], [9, 2], [10, -2], [13, -5], [14, -10], [12, -14],
  [13, -19], [16, -22], [18, -28], [18, -34], [24, -34], [28, -33],
  [32, -29], [33, -26], [35, -22], [41, -14], [40, -5], [43, 0],
  [45, 4], [48, 8], [51, 11], [50, 12], [43, 11], [43, 13],
  [38, 17], [34, 22], [32, 30], [27, 32], [20, 32], [12, 34],
  [10, 34], [8, 36], [2, 36], [-5, 35], [-8, 33], [-13, 27], [-17, 21],
];

const MADAGASCAR: LonLat[] = [
  [43, -25], [45, -26], [50, -15], [49, -12], [47, -15], [44, -20], [43, -25],
];

// Main Eurasian landmass east of Europe. Europe polygon above already covers
// the European portion; this polygon covers Asia from the Urals eastward.
const ASIA: LonLat[] = [
  [26, 40], [28, 42], [38, 42], [45, 40], [50, 44], [54, 42], [60, 42],
  [65, 42], [70, 40], [75, 36], [78, 35], [85, 30], [92, 28], [95, 27],
  [98, 22], [102, 22], [106, 19], [108, 16], [109, 11], [105, 8],
  [104, 10], [100, 13], [98, 16], [94, 16], [92, 21], [90, 22], [88, 22],
  [80, 8], [77, 8], [73, 15], [72, 20], [69, 22], [67, 25], [61, 25],
  [58, 23], [55, 27], [50, 27], [45, 30], [40, 34], [36, 36], [30, 36],
  [26, 40],
];

const ASIA_NORTH: LonLat[] = [
  [45, 45], [60, 50], [70, 55], [80, 58], [95, 58], [110, 55], [122, 55],
  [135, 55], [140, 52], [145, 57], [155, 57], [162, 60], [170, 65],
  [180, 68], [180, 75], [160, 78], [130, 77], [110, 77], [85, 77],
  [65, 77], [55, 72], [45, 70], [40, 65], [42, 60], [45, 55], [48, 50],
  [45, 45],
];

const CHINA_JAPAN_KOREA: LonLat[] = [
  [100, 40], [108, 42], [115, 42], [120, 40], [122, 37], [120, 35],
  [122, 31], [121, 28], [117, 24], [112, 21], [108, 21], [105, 22],
  [100, 25], [98, 28], [95, 30], [92, 33], [95, 37], [100, 40],
];

const JAPAN: LonLat[] = [
  [130, 31], [132, 34], [136, 35], [139, 35], [141, 38], [141, 41],
  [144, 43], [145, 45], [141, 45], [140, 42], [136, 37], [132, 34],
  [130, 31],
];

const INDONESIA_SUMATRA: LonLat[] = [
  [95, 5], [100, 1], [105, -5], [103, -6], [98, -2], [95, 5],
];

const INDONESIA_JAVA: LonLat[] = [
  [105, -6], [115, -8], [114, -7], [106, -5], [105, -6],
];

const INDONESIA_BORNEO: LonLat[] = [
  [109, 1], [118, 1], [118, 5], [113, 7], [109, 4], [109, 1],
];

const INDONESIA_SULAWESI: LonLat[] = [
  [119, -5], [121, -3], [124, 0], [125, 2], [122, 1], [120, -2], [119, -5],
];

const PHILIPPINES: LonLat[] = [
  [120, 6], [125, 6], [126, 10], [125, 14], [122, 18], [120, 18],
  [121, 14], [120, 10], [120, 6],
];

const AUSTRALIA: LonLat[] = [
  [114, -22], [115, -32], [118, -35], [122, -34], [129, -32], [135, -34],
  [138, -35], [141, -38], [146, -39], [150, -37], [153, -28], [153, -25],
  [150, -22], [146, -19], [142, -11], [138, -11], [135, -12], [131, -12],
  [126, -14], [123, -17], [116, -20], [114, -22],
];

const NEW_ZEALAND_N: LonLat[] = [
  [173, -35], [176, -37], [179, -37], [176, -41], [173, -40], [173, -35],
];

const NEW_ZEALAND_S: LonLat[] = [
  [167, -46], [171, -44], [174, -41], [174, -43], [170, -46], [167, -46],
];

const NEW_GUINEA: LonLat[] = [
  [132, -2], [141, -3], [150, -6], [150, -10], [143, -9], [135, -6], [132, -2],
];

const CUBA: LonLat[] = [
  [-85, 22], [-82, 23], [-77, 22], [-74, 20], [-79, 21], [-84, 21], [-85, 22],
];

const HISPANIOLA: LonLat[] = [
  [-74, 18], [-72, 19], [-68, 20], [-68, 18], [-72, 17], [-74, 18],
];

export const WORLD_LAND_SHAPES: LandShape[] = [
  { id: 'na', name: 'North America', points: NORTH_AMERICA },
  { id: 'greenland', name: 'Greenland', points: GREENLAND },
  { id: 'sa', name: 'South America', points: SOUTH_AMERICA },
  { id: 'eu', name: 'Europe', points: EUROPE },
  { id: 'uk', name: 'United Kingdom', points: UK },
  { id: 'ie', name: 'Ireland', points: IRELAND },
  { id: 'is', name: 'Iceland', points: ICELAND },
  { id: 'af', name: 'Africa', points: AFRICA },
  { id: 'mg', name: 'Madagascar', points: MADAGASCAR },
  { id: 'asia', name: 'Asia', points: ASIA },
  { id: 'asia-n', name: 'Northern Asia', points: ASIA_NORTH },
  { id: 'cn', name: 'China', points: CHINA_JAPAN_KOREA },
  { id: 'jp', name: 'Japan', points: JAPAN },
  { id: 'id-sumatra', name: 'Sumatra', points: INDONESIA_SUMATRA },
  { id: 'id-java', name: 'Java', points: INDONESIA_JAVA },
  { id: 'id-borneo', name: 'Borneo', points: INDONESIA_BORNEO },
  { id: 'id-sulawesi', name: 'Sulawesi', points: INDONESIA_SULAWESI },
  { id: 'ph', name: 'Philippines', points: PHILIPPINES },
  { id: 'au', name: 'Australia', points: AUSTRALIA },
  { id: 'nz-n', name: 'New Zealand (North)', points: NEW_ZEALAND_N },
  { id: 'nz-s', name: 'New Zealand (South)', points: NEW_ZEALAND_S },
  { id: 'png', name: 'New Guinea', points: NEW_GUINEA },
  { id: 'cu', name: 'Cuba', points: CUBA },
  { id: 'hi', name: 'Hispaniola', points: HISPANIOLA },
];

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

// Rough contiguous-US outline (Canadian & Mexican borders approximated).
const US_OUTLINE: LonLat[] = [
  [-124, 48], [-123, 46], [-124, 43], [-124, 40], [-122, 37], [-121, 35],
  [-118, 34], [-117, 33], [-115, 32], [-111, 31], [-108, 31], [-108, 32],
  [-106, 32], [-104, 30], [-102, 30], [-100, 29], [-97, 26], [-97, 28],
  [-94, 29], [-91, 30], [-89, 30], [-88, 30], [-87, 31], [-85, 30],
  [-84, 30], [-83, 29], [-82, 27], [-81, 25], [-80, 25], [-80, 27],
  [-81, 31], [-80, 32], [-79, 33], [-76, 35], [-75, 36], [-75, 38],
  [-74, 40], [-71, 41], [-70, 42], [-70, 43], [-68, 44], [-67, 45],
  [-69, 47], [-71, 45], [-74, 45], [-77, 45], [-79, 44], [-82, 42],
  [-83, 42], [-83, 46], [-88, 48], [-92, 47], [-94, 49], [-97, 49],
  [-104, 49], [-110, 49], [-115, 49], [-123, 49], [-124, 48],
];

// Four US region polygons. Together they cover the lower-48 outline.
// Boundaries follow Census Bureau divisions, roughly:
//   West:    lon < -104 (Mountain + Pacific states)
//   Central: lon -104..-90, lat > 36 (Plains + upper Midwest)
//   South:   lon -104..-76, lat < 37 (TX, Gulf, Southeast)
//   East:    lon > -90, lat > 36 (Great Lakes, Mid-Atlantic, New England)

const US_WEST: LonLat[] = [
  [-124, 48], [-123, 46], [-124, 43], [-124, 40], [-122, 37], [-121, 35],
  [-118, 34], [-117, 33], [-115, 32], [-111, 31], [-108, 31], [-104, 32],
  [-104, 37], [-104, 41], [-104, 49], [-110, 49], [-115, 49], [-123, 49],
  [-124, 48],
];

const US_CENTRAL: LonLat[] = [
  [-104, 49], [-104, 41], [-104, 37], [-95, 37], [-90, 37], [-88, 37],
  [-87, 39], [-86, 41], [-85, 42], [-83, 42], [-83, 46], [-88, 48],
  [-92, 47], [-94, 49], [-97, 49], [-104, 49],
];

const US_SOUTH: LonLat[] = [
  [-108, 31], [-106, 32], [-104, 30], [-102, 30], [-100, 29], [-97, 26],
  [-97, 28], [-94, 29], [-91, 30], [-89, 30], [-88, 30], [-85, 30],
  [-84, 30], [-83, 29], [-82, 27], [-81, 25], [-80, 25], [-80, 27],
  [-81, 31], [-80, 32], [-79, 33], [-76, 35], [-77, 37], [-82, 37],
  [-88, 37], [-90, 37], [-95, 37], [-104, 37], [-104, 32], [-108, 31],
];

const US_EAST: LonLat[] = [
  [-83, 42], [-85, 42], [-86, 41], [-87, 39], [-88, 37], [-82, 37],
  [-77, 37], [-76, 35], [-75, 36], [-75, 38], [-74, 40], [-71, 41],
  [-70, 42], [-70, 43], [-68, 44], [-67, 45], [-69, 47], [-71, 45],
  [-74, 45], [-77, 45], [-79, 44], [-82, 42], [-83, 42],
];

export const US_OUTLINE_SHAPE: LandShape = {
  id: 'us-outline',
  name: 'Contiguous United States',
  points: US_OUTLINE,
};

export const US_REGION_SHAPES: USRegionShape[] = [
  {
    id: 'us-west',
    name: 'US West',
    short: 'us-west',
    points: US_WEST,
    hub: [-120, 39],
    population: 0.22,
  },
  {
    id: 'us-central',
    name: 'US Central',
    short: 'us-central',
    points: US_CENTRAL,
    hub: [-95, 42],
    population: 0.24,
  },
  {
    id: 'us-south',
    name: 'US South',
    short: 'us-south',
    points: US_SOUTH,
    hub: [-92, 32],
    population: 0.32,
  },
  {
    id: 'us-east',
    name: 'US East',
    short: 'us-east',
    points: US_EAST,
    hub: [-77, 40],
    population: 0.22,
  },
];
