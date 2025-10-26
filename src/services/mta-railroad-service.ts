// MTA Railroad Service (LIRR & Metro-North)
// Unified service for both commuter railroads

import {
  loadRailroadRoutes,
  getStopsForRoute,
  getRoutesForStop,
  getStopById
} from './railroad-gtfs-parser';

export type Railroad = 'lirr' | 'mnrr';

export interface RailroadInfo {
  id: Railroad;
  name: string;
  fullName: string;
}

export const RAILROADS: RailroadInfo[] = [
  {
    id: 'lirr',
    name: 'LIRR',
    fullName: 'Long Island Rail Road'
  },
  {
    id: 'mnrr',
    name: 'Metro-North',
    fullName: 'Metro-North Railroad'
  }
];

export interface RailroadRouteInfo {
  id: string;
  shortName?: string;
  longName: string;
  color: string;
  textColor: string;
  acronym?: string;
}

export interface RailroadStopInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  routes: string[];
}

// Route acronym mappings for display
const ROUTE_ACRONYMS: Record<Railroad, Record<string, string>> = {
  'mnrr': {
    '1': 'HD',  // Hudson
    '2': 'HR',  // Harlem
    '3': 'NH',  // New Haven
    '4': 'NC',  // New Canaan
    '5': 'DB',  // Danbury
    '6': 'WB',  // Waterbury
  },
  'lirr': {
    '1': 'BB',   // Babylon Branch
    '2': 'HP',   // Hempstead Branch
    '3': 'OB',   // Oyster Bay Branch
    '4': 'RK',   // Ronkonkoma Branch
    '5': 'MK',   // Montauk Branch
    '6': 'LB',   // Long Beach Branch
    '7': 'FR',   // Far Rockaway Branch
    '8': 'WH',   // West Hempstead Branch
    '9': 'PW',   // Port Washington Branch
    '10': 'PJ',  // Port Jefferson Branch
    '11': 'BP',  // Belmont Park
    '12': 'CT',  // City Terminal Zone
    '13': 'GP',  // Greenport Service
  }
};

/**
 * Get all routes for a railroad
 */
export async function getAllRoutes(railroad: Railroad): Promise<RailroadRouteInfo[]> {
  const routesMap = await loadRailroadRoutes(railroad);
  const acronyms = ROUTE_ACRONYMS[railroad] || {};
  
  return Array.from(routesMap.values()).map(route => ({
    id: route.routeId,
    shortName: route.routeShortName,
    longName: route.routeLongName,
    color: route.routeColor,
    textColor: route.routeTextColor,
    acronym: acronyms[route.routeId]
  })).sort((a, b) => a.longName.localeCompare(b.longName));
}

/**
 * Get all stops for a specific route
 */
export async function getStopsForRouteService(railroad: Railroad, routeId: string): Promise<RailroadStopInfo[]> {
  const stops = await getStopsForRoute(railroad, routeId);
  
  // Get all routes for each stop
  const stopsWithRoutes = await Promise.all(
    stops.map(async (stop) => {
      const routes = await getRoutesForStop(railroad, stop.stopId);
      return {
        id: stop.stopId,
        name: stop.stopName,
        lat: stop.stopLat,
        lon: stop.stopLon,
        routes: routes
      };
    })
  );
  
  return stopsWithRoutes.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a stop by ID
 */
export async function getStopByIdService(railroad: Railroad, stopId: string): Promise<RailroadStopInfo | null> {
  const stop = await getStopById(railroad, stopId);
  
  if (!stop) return null;
  
  const routes = await getRoutesForStop(railroad, stop.stopId);
  
  return {
    id: stop.stopId,
    name: stop.stopName,
    lat: stop.stopLat,
    lon: stop.stopLon,
    routes: routes
  };
}
