// MTA Railroad Real-time Service (LIRR & Metro-North)
// Uses MTA GTFS-Realtime feeds

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { Railroad } from './mta-railroad-service';

// GTFS feed URLs for railroads
const RAILROAD_FEEDS: Record<Railroad, string> = {
  'lirr': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr',
  'mnrr': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr'
};

// Map of Metro-North routes to their typical terminal destinations
const MNRR_ROUTE_TERMINALS: Record<string, { inbound: string; outbound: string[] }> = {
  '1': { inbound: 'Grand Central', outbound: ['Poughkeepsie', 'Croton-Harmon'] },
  '2': { inbound: 'Grand Central', outbound: ['Wassaic', 'Dover Plains', 'Southeast'] },
  '3': { inbound: 'Grand Central', outbound: ['New Haven', 'Stamford', 'South Norwalk'] },
  '4': { inbound: 'Grand Central', outbound: ['New Canaan'] },
  '5': { inbound: 'Grand Central', outbound: ['Danbury'] },
  '6': { inbound: 'Grand Central', outbound: ['Waterbury'] },
};

// Map of LIRR routes to their typical terminal destinations
const LIRR_ROUTE_TERMINALS: Record<string, { westbound: string; eastbound: string[] }> = {
  '1': { westbound: 'Penn Station', eastbound: ['Ronkonkoma'] },
  '2': { westbound: 'Penn Station', eastbound: ['Babylon'] },
  '3': { westbound: 'Penn Station', eastbound: ['Long Beach'] },
  '4': { westbound: 'Penn Station', eastbound: ['Far Rockaway', 'Long Beach'] },
  '5': { westbound: 'Penn Station', eastbound: ['Hempstead'] },
  '7': { westbound: 'Penn Station', eastbound: ['Oyster Bay'] },
  '8': { westbound: 'Flatbush Avenue', eastbound: ['Jamaica'] },
  '9': { westbound: 'Penn Station', eastbound: ['Port Washington'] },
  '10': { westbound: 'Penn Station', eastbound: ['Huntington', 'Port Jefferson'] },
  '11': { westbound: 'Penn Station', eastbound: ['Montauk', 'Speonk'] },
  '12': { westbound: 'Penn Station', eastbound: ['West Hempstead'] },
};

const tripsCache = new Map<Railroad, Map<string, { tripHeadsign: string; routeId: string }>>();

/**
 * Determine destination for a trip based on route and stop sequence
 */
function getDestinationForTrip(railroad: Railroad, routeId: string, currentStopId: string, stopSequence: any[], allStops: Map<string, any>): string {
  if (railroad === 'mnrr') {
    const terminals = MNRR_ROUTE_TERMINALS[routeId];
    if (!terminals) return 'Unknown Destination';
    
    // Grand Central is stop ID "1" for Metro-North
    // Find the last stop in the sequence - that's the actual destination
    if (stopSequence.length === 0) {
      return terminals.outbound[0];
    }
    
    const lastStopId = stopSequence[stopSequence.length - 1].stopId;
    
    // If last stop is Grand Central, train is going inbound
    if (lastStopId === '1') {
      return terminals.inbound;
    }
    
    // Otherwise, look up the last stop's name from the stops data
    const lastStop = allStops.get(lastStopId);
    if (lastStop && lastStop.name) {
      return lastStop.name;
    }
    
    // Fallback to the primary outbound terminal
    return terminals.outbound[0];
  } else {
    // LIRR
    const terminals = LIRR_ROUTE_TERMINALS[routeId];
    if (!terminals) return 'Unknown Destination';
    
    // For LIRR, find the last stop in the sequence
    if (stopSequence.length === 0) {
      return terminals.eastbound[0];
    }
    
    const lastStopId = stopSequence[stopSequence.length - 1].stopId;
    
    // If last stop is Penn Station (8) or Atlantic Terminal (138), train is going westbound
    if (lastStopId === '8' || lastStopId === '138') {
      return lastStopId === '8' ? 'Penn Station' : 'Atlantic Terminal';
    }
    
    // Otherwise, look up the last stop's name
    const lastStop = allStops.get(lastStopId);
    if (lastStop && lastStop.name) {
      return lastStop.name;
    }
    
    // Fallback
    return terminals.eastbound[0];
  }
}

/**
 * Load trips data from GTFS static data
 */
async function loadTripsData(railroad: Railroad): Promise<Map<string, { tripHeadsign: string; routeId: string }>> {
  if (tripsCache.has(railroad)) {
    return tripsCache.get(railroad)!;
  }

  console.log(`Loading trips data for ${railroad.toUpperCase()}...`);
  const tripsMap = new Map<string, { tripHeadsign: string; routeId: string }>();

  try {
    const path = `/src/services/mta-${railroad}-data/trips.txt`;
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load trips.txt for ${railroad}`);
    }
    const tripsData = await response.text();
    
    // Parse CSV with proper handling of quoted fields
    const lines = tripsData.trim().split('\n');
    if (lines.length === 0) return tripsMap;

    // Parse header
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

    const tripIdIndex = headers.indexOf('trip_id');
    const tripHeadsignIndex = headers.indexOf('trip_headsign');
    const routeIdIndex = headers.indexOf('route_id');

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line with quote support
      const values: string[] = [];
      currentField = '';
      inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      values.push(currentField.trim());
      
      if (tripIdIndex >= 0 && values[tripIdIndex]) {
        tripsMap.set(values[tripIdIndex], {
          tripHeadsign: tripHeadsignIndex >= 0 ? (values[tripHeadsignIndex] || '') : '',
          routeId: routeIdIndex >= 0 ? (values[routeIdIndex] || '') : ''
        });
      }
    }

    console.log(`Loaded ${tripsMap.size} trips for ${railroad.toUpperCase()}`);
    console.log(`Sample trip IDs:`, Array.from(tripsMap.keys()).slice(0, 5));
    tripsCache.set(railroad, tripsMap);
    return tripsMap;
  } catch (error) {
    console.error(`Error loading trips data for ${railroad}:`, error);
    return tripsMap;
  }
}

export interface RailroadArrival {
  routeId: string;
  tripId: string;
  stopId: string;
  arrivalTime: number; // Unix timestamp in seconds
  departureTime: number; // Unix timestamp in seconds
  track?: string;
  status?: string;
  destination?: string;
}

export interface RailroadRealtimeData {
  stopId: string;
  arrivals: RailroadArrival[];
  lastUpdated: number;
}

/**
 * Parse GTFS-Realtime feed for railroad arrivals
 */
async function parseRailroadRealtimeFeed(
  feed: any,
  stopId: string,
  railroad: Railroad,
  routeId?: string
): Promise<RailroadArrival[]> {
  const arrivals: RailroadArrival[] = [];

  console.log(`🚂 === PARSING RAILROAD FEED ===`);
  console.log(`Parsing feed for stop ${stopId}${routeId ? `, route ${routeId}` : ''}`);
  console.log(`Feed has ${feed.entity.length} entities`);

  // Load trips data for destination lookup
  const tripsData = await loadTripsData(railroad);
  console.log(`✅ Loaded ${tripsData.size} trips for destination lookup`);

  // Load stops data for station name lookup
  const stopsMap = new Map<string, any>();
  try {
    const path = `/src/services/mta-${railroad}-data/stops.txt`;
    const response = await fetch(path);
    if (response.ok) {
      const stopsText = await response.text();
      const lines = stopsText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const stopIdIndex = headers.indexOf('stop_id');
      const stopNameIndex = headers.indexOf('stop_name');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        if (stopIdIndex >= 0 && stopNameIndex >= 0 && values[stopIdIndex]) {
          stopsMap.set(values[stopIdIndex], { name: values[stopNameIndex] });
        }
      }
      console.log(`✅ Loaded ${stopsMap.size} stops for name lookup`);
    }
  } catch (error) {
    console.warn('Could not load stops data:', error);
  }

  feed.entity.forEach((entity: any) => {
    if (!entity.tripUpdate) return;

    const trip = entity.tripUpdate.trip;
    const stopTimeUpdates = entity.tripUpdate.stopTimeUpdate || [];

    // Debug: Log all available trip and entity fields
    if (arrivals.length === 0) {
      console.log(`📋 Trip object keys:`, Object.keys(trip));
      console.log(`📋 Sample trip object:`, JSON.stringify(trip, null, 2));
      console.log(`📋 Entity keys:`, Object.keys(entity));
      console.log(`📋 TripUpdate keys:`, Object.keys(entity.tripUpdate));
      if (entity.tripUpdate.stopTimeUpdate && entity.tripUpdate.stopTimeUpdate[0]) {
        console.log(`📋 StopTimeUpdate keys:`, Object.keys(entity.tripUpdate.stopTimeUpdate[0]));
        console.log(`📋 Sample stopTimeUpdate:`, JSON.stringify(entity.tripUpdate.stopTimeUpdate[0], null, 2));
      }
    }

    // Filter by route if specified
    if (routeId && trip.routeId !== routeId) return;

    // Find updates for our stop
    stopTimeUpdates.forEach((stopTimeUpdate: any) => {
      const updateStopId = stopTimeUpdate.stopId;
      
      // Match the stop
      if (updateStopId !== stopId) return;

      // Extract times
      const getTimeValue = (time: any): number => {
        if (!time) return 0;
        if (typeof time === 'object' && 'low' in time) {
          return time.low;
        }
        return Number(time);
      };

      const arrivalTime = getTimeValue(stopTimeUpdate.arrival?.time) || 
                         getTimeValue(stopTimeUpdate.departure?.time) || 0;
      const departureTime = getTimeValue(stopTimeUpdate.departure?.time) || arrivalTime;

      if (arrivalTime > 0) {
        // Look up destination from trips data first (for LIRR if available)
        const tripId = trip.tripId || '';
        const tripData = tripsData.get(tripId);
        
        // If not found in static data, infer from route and stop sequence
        let destination: string;
        if (tripData?.tripHeadsign) {
          destination = tripData.tripHeadsign;
          console.log(`✅ Found destination from static data: "${destination}"`);
        } else if (trip.tripHeadsign) {
          destination = trip.tripHeadsign;
          console.log(`ℹ️ Using realtime headsign: "${destination}"`);
        } else {
          // Log stop sequence for debugging
          if (arrivals.length < 3) {
            console.log(`📍 Stop sequence for trip ${tripId}:`, stopTimeUpdates.map((s: any) => s.stopId));
            console.log(`   Current stop: ${stopId}, Route: ${trip.routeId}`);
          }
          
          // Infer destination from route and stop sequence
          destination = getDestinationForTrip(railroad, trip.routeId || '', stopId, stopTimeUpdates, stopsMap);
          console.log(`🎯 Inferred destination: "${destination}" (route ${trip.routeId}, current stop ${stopId})`);
        }

        arrivals.push({
          routeId: trip.routeId || '',
          tripId: tripId,
          stopId: updateStopId,
          arrivalTime,
          departureTime,
          track: stopTimeUpdate.departure?.platformId || stopTimeUpdate.arrival?.platformId,
          status: entity.tripUpdate.vehicle?.currentStatus,
          destination: destination
        });
      }
    });
  });

  console.log(`Found ${arrivals.length} arrivals for stop ${stopId}`);
  return arrivals;
}

/**
 * Fetch real-time railroad arrivals for a stop
 */
export const fetchRailroadArrivals = async (
  railroad: Railroad,
  stopId: string,
  routeId?: string
): Promise<RailroadRealtimeData> => {
  const feedUrl = RAILROAD_FEEDS[railroad];

  if (!feedUrl) {
    throw new Error(`No feed found for railroad ${railroad}`);
  }

  try {
    console.log(`Fetching ${railroad.toUpperCase()} data for stop ${stopId}${routeId ? `, route ${routeId}` : ''}`);
    console.log(`Feed URL: ${feedUrl}`);

    const response = await fetch(feedUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    console.log('=== FEED DATA ===');
    console.log('Feed header:', feed.header);
    console.log('Number of entities:', feed.entity.length);
    console.log('=================');

    const allArrivals = await parseRailroadRealtimeFeed(feed, stopId, railroad, routeId);

    // Sort by arrival time
    allArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

    return {
      stopId,
      arrivals: allArrivals,
      lastUpdated: Date.now()
    };

  } catch (error) {
    console.error(`Error fetching ${railroad.toUpperCase()} arrivals:`, error);
    throw error;
  }
};

/**
 * Fetch arrivals for multiple routes at a stop
 */
export const fetchRailroadArrivalsMultiRoute = async (
  railroad: Railroad,
  stopId: string,
  routeIds: string[]
): Promise<RailroadRealtimeData> => {
  try {
    console.log(`Fetching ${railroad.toUpperCase()} arrivals for stop ${stopId}, routes: ${routeIds.join(', ')}`);

    // Fetch once and filter for all routes
    const feedUrl = RAILROAD_FEEDS[railroad];
    const response = await fetch(feedUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    // Parse without route filter to get all arrivals at this stop
    const allArrivals = await parseRailroadRealtimeFeed(feed, stopId, railroad);

    // Sort by arrival time
    allArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

    return {
      stopId,
      arrivals: allArrivals,
      lastUpdated: Date.now()
    };

  } catch (error) {
    console.error(`Error fetching ${railroad.toUpperCase()} arrivals:`, error);
    throw error;
  }
};

/**
 * Mock data for testing without API
 */
export const getMockRailroadArrivals = (stopId: string, routeId: string): RailroadRealtimeData => {
  const now = Math.floor(Date.now() / 1000);

  return {
    stopId,
    arrivals: [
      {
        routeId,
        tripId: `mock-trip-1`,
        stopId,
        arrivalTime: now + 300, // 5 minutes
        departureTime: now + 360,
        track: '1',
        destination: 'Penn Station'
      },
      {
        routeId,
        tripId: `mock-trip-2`,
        stopId,
        arrivalTime: now + 900, // 15 minutes
        departureTime: now + 960,
        track: '2',
        destination: 'Jamaica'
      },
      {
        routeId,
        tripId: `mock-trip-3`,
        stopId,
        arrivalTime: now + 1800, // 30 minutes
        departureTime: now + 1860,
        track: '1',
        destination: 'Penn Station'
      },
    ],
    lastUpdated: Date.now()
  };
};
