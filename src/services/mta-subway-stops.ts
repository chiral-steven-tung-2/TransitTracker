// MTA Subway Stops Service
// Uses parsed GTFS static data

import { getStopsCache, getStopsForRoute, getRoutesForStop, searchStops as gtfsSearchStops, type GTFSStop } from './gtfs-parser';

export interface SubwayStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  routes: string[]; // Array of route IDs that serve this stop
  borough?: string;
}

/**
 * Convert GTFS stop to SubwayStop format
 */
function convertGTFSStop(gtfsStop: GTFSStop, routes: string[] = []): SubwayStop {
  return {
    id: gtfsStop.stopId,
    name: gtfsStop.stopName,
    lat: gtfsStop.stopLat,
    lon: gtfsStop.stopLon,
    routes: routes,
    borough: undefined // Could be derived from location or stop ID patterns
  };
}

/**
 * Fetch subway stops for a given route
 */
export const fetchSubwayStopsForRoute = async (routeId: string): Promise<SubwayStop[]> => {
  // Use the new getStopsForRoute function that parses stop_times and trips
  const gtfsStops = await getStopsForRoute(routeId);
  
  // Convert to SubwayStop format and populate all routes for each stop
  const stopsPromises = gtfsStops.map(async (stop) => {
    const allRoutes = await getRoutesForStop(stop.stopId);
    return convertGTFSStop(stop, allRoutes);
  });
  
  const stops = await Promise.all(stopsPromises);
  return stops.sort((a, b) => a.id.localeCompare(b.id));
};

/**
 * Fetch a specific subway stop by ID
 */
export const fetchSubwayStopById = async (stopId: string): Promise<SubwayStop | null> => {
  const stops = await getStopsCache();
  const stop = stops.get(stopId);
  
  if (!stop) return null;
  
  return convertGTFSStop(stop);
};

/**
 * Search subway stops by name
 */
export const searchSubwayStops = async (query: string): Promise<SubwayStop[]> => {
  const results = await gtfsSearchStops(query);
  return results.map(stop => convertGTFSStop(stop));
};
