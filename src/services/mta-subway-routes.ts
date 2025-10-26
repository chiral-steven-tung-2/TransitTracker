// MTA Subway Routes Service
// Using parsed GTFS data for subway lines

import { getRoutesCache, type GTFSRoute } from './gtfs-parser';

export interface SubwayRoute {
  id: string;
  shortName: string;
  longName: string;
  description: string;
  color: string;
  textColor: string;
}

/**
 * Convert GTFS route to SubwayRoute format
 */
function convertGTFSRoute(gtfsRoute: GTFSRoute): SubwayRoute {
  // MTA stores colors without # prefix, add it
  const color = gtfsRoute.routeColor ? `#${gtfsRoute.routeColor}` : '#808183';
  const textColor = gtfsRoute.routeTextColor ? `#${gtfsRoute.routeTextColor}` : '#FFFFFF';
  
  return {
    id: gtfsRoute.routeId,
    shortName: gtfsRoute.routeShortName,
    longName: gtfsRoute.routeLongName,
    description: gtfsRoute.routeDesc,
    color,
    textColor
  };
}

let routesPromise: Promise<SubwayRoute[]> | null = null;

export const getAllSubwayRoutes = async (): Promise<SubwayRoute[]> => {
  if (!routesPromise) {
    routesPromise = (async () => {
      const routes = await getRoutesCache();
      return Array.from(routes.values()).map(convertGTFSRoute);
    })();
  }
  return routesPromise;
};

export const getSubwayRouteById = async (id: string): Promise<SubwayRoute | undefined> => {
  const routes = await getRoutesCache();
  const route = routes.get(id);
  return route ? convertGTFSRoute(route) : undefined;
};

export const getSubwayRouteGroups = async (): Promise<{ name: string; routes: SubwayRoute[] }[]> => {
  const allRoutes = await getAllSubwayRoutes();
  
  // Group routes by line families
  const groups: { [key: string]: SubwayRoute[] } = {
    '123': [],
    '456': [],
    '7': [],
    'NQRW': [],
    'ACE': [],
    'BDFM': [],
    'L': [],
    'JZ': [],
    'G': [],
    'S': []
  };
  
  allRoutes.forEach(route => {
    const id = route.id;
    if (['1', '2', '3'].includes(id)) groups['123'].push(route);
    else if (['4', '5', '6', '5X', '6X'].includes(id)) groups['456'].push(route);
    else if (['7', '7X'].includes(id)) groups['7'].push(route);
    else if (['N', 'Q', 'R', 'W'].includes(id)) groups['NQRW'].push(route);
    else if (['A', 'C', 'E'].includes(id)) groups['ACE'].push(route);
    else if (['B', 'D', 'F', 'M', 'FX'].includes(id)) groups['BDFM'].push(route);
    else if (id === 'L') groups['L'].push(route);
    else if (['J', 'Z'].includes(id)) groups['JZ'].push(route);
    else if (id === 'G') groups['G'].push(route);
    else if (id.includes('S') || id === 'GS' || id === 'FS') groups['S'].push(route);
  });
  
  return [
    { name: '1/2/3 Lines', routes: groups['123'] },
    { name: '4/5/6 Lines', routes: groups['456'] },
    { name: '7 Line', routes: groups['7'] },
    { name: 'N/Q/R/W Lines', routes: groups['NQRW'] },
    { name: 'A/C/E Lines', routes: groups['ACE'] },
    { name: 'B/D/F/M Lines', routes: groups['BDFM'] },
    { name: 'L Line', routes: groups['L'] },
    { name: 'J/Z Lines', routes: groups['JZ'] },
    { name: 'G Line', routes: groups['G'] },
    { name: 'Shuttles', routes: groups['S'] },
  ].filter(group => group.routes.length > 0);
};
