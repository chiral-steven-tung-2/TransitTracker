// Railroad GTFS Parser (LIRR & Metro-North)
// Generic parser for commuter rail GTFS data

export interface RailroadRoute {
  routeId: string;
  routeShortName?: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  routeType: string;
}

export interface RailroadStop {
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  locationType?: string;
  parentStation?: string;
}

// Cache for parsed data
const caches: {
  [key: string]: {
    routes?: Map<string, RailroadRoute>;
    stops?: Map<string, RailroadStop>;
    routeStops?: Map<string, Set<string>>;
    trips?: Map<string, any>;
  }
} = {
  lirr: {},
  mnrr: {}
};

/**
 * Parse CSV data with support for quoted fields
 */
function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];

  // Parse header - handle quoted headers
  const headerLine = lines[0];
  const headers: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField) headers.push(currentField.trim());

  // Parse data rows
  const result: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const obj: any = {};
    
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    
    result.push(obj as T);
  }

  return result;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue);

  return values;
}

/**
 * Load GTFS file for a specific railroad
 */
async function loadGTFSFile(railroad: 'lirr' | 'mnrr', filename: string): Promise<string> {
  const path = `/src/services/mta-${railroad}-data/${filename}`;
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${filename} for ${railroad}`);
  }
  return response.text();
}

/**
 * Load all routes for a railroad
 */
export async function loadRailroadRoutes(railroad: 'lirr' | 'mnrr'): Promise<Map<string, RailroadRoute>> {
  if (caches[railroad].routes) return caches[railroad].routes!;

  const routesMap = new Map<string, RailroadRoute>();
  const routesData = await loadGTFSFile(railroad, 'routes.txt');
  const routes = parseCSV<any>(routesData);

  routes.forEach(route => {
    routesMap.set(route.route_id, {
      routeId: route.route_id,
      routeShortName: route.route_short_name,
      routeLongName: route.route_long_name,
      routeColor: route.route_color ? `#${route.route_color}` : '#808183',
      routeTextColor: route.route_text_color ? `#${route.route_text_color}` : '#FFFFFF',
      routeType: route.route_type
    });
  });

  caches[railroad].routes = routesMap;
  console.log(`Loaded ${routesMap.size} routes for ${railroad.toUpperCase()}`);
  return routesMap;
}

/**
 * Load all stops for a railroad
 */
export async function loadRailroadStops(railroad: 'lirr' | 'mnrr'): Promise<Map<string, RailroadStop>> {
  if (caches[railroad].stops) return caches[railroad].stops!;

  const stopsMap = new Map<string, RailroadStop>();
  const stopsData = await loadGTFSFile(railroad, 'stops.txt');
  const stops = parseCSV<any>(stopsData);

  stops.forEach(stop => {
    stopsMap.set(stop.stop_id, {
      stopId: stop.stop_id,
      stopName: stop.stop_name,
      stopLat: parseFloat(stop.stop_lat),
      stopLon: parseFloat(stop.stop_lon),
      locationType: stop.location_type,
      parentStation: stop.parent_station
    });
  });

  caches[railroad].stops = stopsMap;
  console.log(`Loaded ${stopsMap.size} stops for ${railroad.toUpperCase()}`);
  return stopsMap;
}

/**
 * Build route-to-stops mapping for a railroad
 */
async function buildRouteStopsMapping(railroad: 'lirr' | 'mnrr'): Promise<Map<string, Set<string>>> {
  if (caches[railroad].routeStops) return caches[railroad].routeStops!;

  console.log(`Building route-to-stops mapping for ${railroad.toUpperCase()}...`);
  const routeStopsMap = new Map<string, Set<string>>();

  // Load trips to get route_id for each trip_id
  const tripsData = await loadGTFSFile(railroad, 'trips.txt');
  const trips = parseCSV<any>(tripsData);
  
  const tripToRoute = new Map<string, string>();
  trips.forEach(trip => {
    tripToRoute.set(trip.trip_id, trip.route_id);
  });

  // Parse stop_times to see which stops each trip visits
  const stopTimesData = await loadGTFSFile(railroad, 'stop_times.txt');
  const stopTimes = parseCSV<any>(stopTimesData);

  stopTimes.forEach(stopTime => {
    const tripId = stopTime.trip_id;
    const stopId = stopTime.stop_id;
    const routeId = tripToRoute.get(tripId);

    if (routeId && stopId) {
      if (!routeStopsMap.has(routeId)) {
        routeStopsMap.set(routeId, new Set());
      }
      routeStopsMap.get(routeId)!.add(stopId);
    }
  });

  caches[railroad].routeStops = routeStopsMap;
  console.log(`Route-to-stops mapping complete for ${railroad.toUpperCase()}`);
  return routeStopsMap;
}

/**
 * Get all stops for a specific route
 */
export async function getStopsForRoute(railroad: 'lirr' | 'mnrr', routeId: string): Promise<RailroadStop[]> {
  const routeStopsMap = await buildRouteStopsMapping(railroad);
  const stops = await loadRailroadStops(railroad);

  const stopIdsForRoute = routeStopsMap.get(routeId);
  if (!stopIdsForRoute) {
    console.log(`No stops found for route ${routeId} on ${railroad.toUpperCase()}`);
    return [];
  }

  console.log(`Route ${routeId} has ${stopIdsForRoute.size} stops on ${railroad.toUpperCase()}`);

  const routeStops: RailroadStop[] = [];
  const seenParents = new Set<string>();

  stopIdsForRoute.forEach(stopId => {
    const stop = stops.get(stopId);
    if (stop) {
      // Group by parent station - only show one entry per station
      const parent = stop.parentStation || stop.stopId;
      if (!seenParents.has(parent)) {
        seenParents.add(parent);
        routeStops.push(stop);
      }
    }
  });

  return routeStops;
}

/**
 * Get all routes for a specific stop
 */
export async function getRoutesForStop(railroad: 'lirr' | 'mnrr', stopId: string): Promise<string[]> {
  const routeStopsMap = await buildRouteStopsMapping(railroad);
  const routesForStop: string[] = [];

  routeStopsMap.forEach((stopIds, routeId) => {
    if (stopIds.has(stopId)) {
      routesForStop.push(routeId);
    }
  });

  console.log(`Stop ${stopId} is served by routes: ${routesForStop.join(', ')} on ${railroad.toUpperCase()}`);
  return routesForStop;
}

/**
 * Get a stop by ID
 */
export async function getStopById(railroad: 'lirr' | 'mnrr', stopId: string): Promise<RailroadStop | null> {
  console.log(`🔍 Looking up stop ID "${stopId}" for ${railroad.toUpperCase()}`);
  const stops = await loadRailroadStops(railroad);
  console.log(`📍 Total stops loaded: ${stops.size}`);
  console.log(`📍 First 5 stop IDs:`, Array.from(stops.keys()).slice(0, 5));
  
  const result = stops.get(stopId) || null;
  console.log(`📍 Found stop:`, result ? `${result.stopName} (${result.stopId})` : 'NOT FOUND');
  
  return result;
}
