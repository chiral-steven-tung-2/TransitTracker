// GTFS Static Data Parser for MTA Subway
// Parses the static GTFS files to get stops, routes, and trip information

export interface GTFSStop {
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  locationType: string;
  parentStation: string;
}

export interface GTFSRoute {
  routeId: string;
  agencyId: string;
  routeShortName: string;
  routeLongName: string;
  routeDesc: string;
  routeType: string;
  routeUrl: string;
  routeColor: string;
  routeTextColor: string;
}

export interface GTFSStopTime {
  tripId: string;
  stopId: string;
  arrivalTime: string;
  departureTime: string;
  stopSequence: number;
}

export interface GTFSTrip {
  tripId: string;
  routeId: string;
  serviceId: string;
  tripHeadsign: string;
  directionId: string;
  shapeId: string;
}

/**
 * Parse CSV text into array of objects
 * Handles quoted fields with commas and newlines
 */
function parseCSV<T>(csvText: string): T[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;
  
  // Split into lines, respecting quoted fields
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if (char === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else if (char === '\r' && nextChar === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
      i++; // Skip the \n
    } else {
      currentLine += char;
    }
  }
  
  // Add the last line
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  
  if (lines.length < 2) return [];
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  const result: T[] = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: any = {};
    
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    
    result.push(obj as T);
  }
  
  return result;
}

/**
 * Parse a single CSV line, respecting quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      insideQuotes = !insideQuotes;
      // Don't include the quotes in the result
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Load GTFS file dynamically
 */
async function loadGTFSFile(filename: string): Promise<string> {
  try {
    const response = await fetch(`/mta-subway-data/${filename}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    throw error;
  }
}

// Cache for loaded data
let stopsCache: Map<string, GTFSStop> | null = null;
let routesCache: Map<string, GTFSRoute> | null = null;
let tripsCache: Map<string, GTFSTrip> | null = null;
let routeStopsCache: Map<string, Set<string>> | null = null;

/**
 * Parse and load all stops
 */
export async function loadStops(): Promise<Map<string, GTFSStop>> {
  if (stopsCache) return stopsCache;
  
  const stopsMap = new Map<string, GTFSStop>();
  const stopsData = await loadGTFSFile('stops.txt');
  
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
  
  stopsCache = stopsMap;
  return stopsMap;
}

/**
 * Parse and load all routes
 */
export async function loadRoutes(): Promise<Map<string, GTFSRoute>> {
  if (routesCache) return routesCache;
  
  const routesMap = new Map<string, GTFSRoute>();
  const routesData = await loadGTFSFile('routes.txt');
  
  const routes = parseCSV<any>(routesData);
  
  routes.forEach(route => {
    routesMap.set(route.route_id, {
      routeId: route.route_id,
      agencyId: route.agency_id,
      routeShortName: route.route_short_name,
      routeLongName: route.route_long_name,
      routeDesc: route.route_desc,
      routeType: route.route_type,
      routeUrl: route.route_url,
      routeColor: route.route_color,
      routeTextColor: route.route_text_color
    });
  });
  
  routesCache = routesMap;
  return routesMap;
}

/**
 * Parse and load all trips
 */
export async function loadTrips(): Promise<Map<string, GTFSTrip>> {
  if (tripsCache) return tripsCache;
  
  const tripsMap = new Map<string, GTFSTrip>();
  const tripsData = await loadGTFSFile('trips.txt');
  
  const trips = parseCSV<any>(tripsData);
  
  trips.forEach(trip => {
    tripsMap.set(trip.trip_id, {
      tripId: trip.trip_id,
      routeId: trip.route_id,
      serviceId: trip.service_id,
      tripHeadsign: trip.trip_headsign || '',
      directionId: trip.direction_id || '0',
      shapeId: trip.shape_id || ''
    });
  });
  
  tripsCache = tripsMap;
  return tripsMap;
}

/**
 * Get parent station stops (main entrances)
 */
export async function getParentStations(): Promise<GTFSStop[]> {
  const stops = await loadStops();
  return Array.from(stops.values()).filter(stop => 
    stop.locationType === '1'
  );
}

/**
 * Get all platform stops for a parent station
 */
export async function getPlatformsForStation(parentStationId: string): Promise<GTFSStop[]> {
  const stops = await loadStops();
  return Array.from(stops.values()).filter(stop => 
    stop.parentStation === parentStationId
  );
}

/**
 * Search stops by name
 */
export async function searchStops(query: string): Promise<GTFSStop[]> {
  const stops = await loadStops();
  const lowerQuery = query.toLowerCase();
  
  return Array.from(stops.values()).filter(stop => 
    stop.stopName.toLowerCase().includes(lowerQuery) &&
    (stop.locationType === '' || stop.locationType === '0')
  );
}

export async function getStopsCache(): Promise<Map<string, GTFSStop>> {
  return await loadStops();
}

export async function getRoutesCache(): Promise<Map<string, GTFSRoute>> {
  return await loadRoutes();
}

export async function getTripsCache(): Promise<Map<string, GTFSTrip>> {
  return await loadTrips();
}

/**
 * Build a mapping of routes to their stops by parsing stop_times and trips
 * This is cached after first load
 */
async function buildRouteStopsMapping(): Promise<Map<string, Set<string>>> {
  if (routeStopsCache) return routeStopsCache;
  
  console.log('Building route-to-stops mapping...');
  const routeStopsMap = new Map<string, Set<string>>();
  
  // Load trips to get route_id for each trip_id
  const trips = await loadTrips();
  
  // Create a map of trip_id -> route_id for faster lookup
  const tripToRoute = new Map<string, string>();
  trips.forEach((trip, tripId) => {
    tripToRoute.set(tripId, trip.routeId);
  });
  
  // Parse stop_times to see which stops each trip visits
  const stopTimesData = await loadGTFSFile('stop_times.txt');
  const stopTimes = parseCSV<any>(stopTimesData);
  
  console.log(`Processing ${stopTimes.length} stop times...`);
  
  stopTimes.forEach(stopTime => {
    const tripId = stopTime.trip_id;
    const stopId = stopTime.stop_id;
    const routeId = tripToRoute.get(tripId);
    
    if (routeId && stopId) {
      if (!routeStopsMap.has(routeId)) {
        routeStopsMap.set(routeId, new Set());
      }
      // Store the actual stop ID (with N/S suffix) as used in the feed
      routeStopsMap.get(routeId)!.add(stopId);
    }
  });
  
  console.log('Route-to-stops mapping complete');
  routeStopsCache = routeStopsMap;
  return routeStopsMap;
}

/**
 * Get all stops that serve a specific route
 */
export async function getStopsForRoute(routeId: string): Promise<GTFSStop[]> {
  const routeStopsMap = await buildRouteStopsMapping();
  const stops = await loadStops();
  
  const stopIdsForRoute = routeStopsMap.get(routeId);
  if (!stopIdsForRoute) {
    console.log(`No stops found for route ${routeId}`);
    return [];
  }
  
  console.log(`Route ${routeId} has ${stopIdsForRoute.size} unique stops`);
  
  // Get the actual stop objects, grouping by parent to show one entry per station
  const routeStops: GTFSStop[] = [];
  const seenParents = new Set<string>();
  
  stopIdsForRoute.forEach(stopId => {
    const stop = stops.get(stopId);
    if (stop) {
      // Group by parent station - only show one platform per station
      const parent = stop.parentStation || stop.stopId;
      if (!seenParents.has(parent)) {
        seenParents.add(parent);
        // Use the first platform stop we encounter (with N/S suffix intact)
        routeStops.push(stop);
      }
    }
  });
  
  return routeStops;
}

/**
 * Get all routes that serve a specific stop (or stop complex)
 */
export async function getRoutesForStop(stopId: string): Promise<string[]> {
  const routeStopsMap = await buildRouteStopsMapping();
  
  // Get base stop ID (without N/S suffix)
  const baseStopId = stopId.replace(/[NS]$/i, '');
  
  // Find all routes that serve this stop (checking both N and S platforms)
  const routesForStop: string[] = [];
  
  routeStopsMap.forEach((stopIds, routeId) => {
    // Check if this route serves either platform of this stop
    const servesStop = Array.from(stopIds).some(sid => 
      sid === stopId || 
      sid === `${baseStopId}N` || 
      sid === `${baseStopId}S` ||
      sid === baseStopId
    );
    
    if (servesStop) {
      routesForStop.push(routeId);
    }
  });
  
  console.log(`Stop ${stopId} is served by routes: ${routesForStop.join(', ')}`);
  return routesForStop;
}
