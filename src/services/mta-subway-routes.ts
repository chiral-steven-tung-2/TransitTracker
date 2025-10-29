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
    'SIR': [],
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
    else if (id === 'SI') groups['SIR'].push(route);
    else if (id.includes('S') || id === 'GS' || id === 'FS') groups['S'].push(route);
  });
  
  return [
    { name: '7th Avenue - Broadway Line', routes: groups['123'] },
    { name: 'Lexington Avenue Line', routes: groups['456'] },
    { name: 'Flushing Line', routes: groups['7'] },
    { name: 'Broadway Line', routes: groups['NQRW'] },
    { name: '8th Avenue Line', routes: groups['ACE'] },
    { name: '6th Avenue Line', routes: groups['BDFM'] },
    { name: 'Canarsie Line', routes: groups['L'] },
    { name: 'Nassau Street Line', routes: groups['JZ'] },
    { name: 'Brooklyn-Queens Crosstown Line', routes: groups['G'] },
    { name: 'Staten Island Railway', routes: groups['SIR'] },
    { name: 'Shuttles', routes: groups['S'] },
  ].filter(group => group.routes.length > 0);
};
