export interface BusStop {
  name: string;
  latitude: number;
  longitude: number;
}

export interface RouteInfo {
  name: string;
  color: string;
  stops: string[];
}

export interface SbuRoute {
  name: string;
  color: string;
  stops: BusStop[];
  schedule?: RouteSchedule;
}

export interface RouteSchedule {
  stopNames: string[];
  runs: BusRun[];
}

export interface BusRun {
  runNumber: number;
  stopTimes: string[]; // Times in "HH:MM" format
}

export interface NextBusInfo {
  stopName: string;
  nextBuses: BusArrival[]; // Array of next buses (up to 3)
}

export interface BusArrival {
  time: string; // "HH:MM" format
  minutesUntil: number;
  runNumber: number;
}

// Fetch CSV file from public folder
const fetchCSV = async (fileName: string): Promise<string> => {
  const response = await fetch(`/sbu-bus-data/${fileName}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${fileName}`);
  }
  return response.text();
};

// Parse the stops list CSV
const parseStopsList = (csv: string): Map<string, BusStop> => {
  const stopsMap = new Map<string, BusStop>();
  const lines = csv.trim().split('\n');
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 3) {
      const name = parts[0].trim();
      const latitude = parseFloat(parts[1].trim());
      const longitude = parseFloat(parts[2].trim());
      
      stopsMap.set(name, { name, latitude, longitude });
    }
  }
  
  return stopsMap;
};

// Parse a route CSV file
const parseRouteCSV = (csv: string, stopsMap: Map<string, BusStop>): SbuRoute | null => {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return null;
  
  // First row: route name and color
  const firstRow = lines[0].split(',');
  const routeName = firstRow[0].trim();
  const routeColor = firstRow[1].trim().toLowerCase();
  
  // Second row: stop names (skip "Run" column)
  const secondRow = lines[1].split(',');
  const stopNames = secondRow.slice(1).map(s => s.trim()).filter(s => s.length > 0);
  
  // Get stop coordinates
  const stops: BusStop[] = [];
  for (const stopName of stopNames) {
    const stop = stopsMap.get(stopName);
    if (stop) {
      stops.push(stop);
    }
  }
  
  // Parse schedule data (rows 3+)
  const runs: BusRun[] = [];
  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length > 1) {
      const runNumber = parseInt(parts[0].trim());
      const stopTimes = parts.slice(1).map(t => t.trim());
      runs.push({ runNumber, stopTimes });
    }
  }
  
  return {
    name: routeName,
    color: routeColor,
    stops,
    schedule: {
      stopNames,
      runs
    }
  };
};

// Main function to get all routes
export const getSbuBusRoutes = async (): Promise<SbuRoute[]> => {
  const stopsListCSV = await fetchCSV('Stops List.csv');
  const stopsMap = parseStopsList(stopsListCSV);
  const routes: SbuRoute[] = [];
  
  const innerLoopCSV = await fetchCSV('Inner Loop.csv');
  const innerLoop = parseRouteCSV(innerLoopCSV, stopsMap);
  if (innerLoop) routes.push(innerLoop);
  
  const outerLoopCSV = await fetchCSV('Outer Loop.csv');
  const outerLoop = parseRouteCSV(outerLoopCSV, stopsMap);
  if (outerLoop) routes.push(outerLoop);
  
  const hospitalChapinCSV = await fetchCSV('Hospital_Chapin.csv');
  const hospitalChapin = parseRouteCSV(hospitalChapinCSV, stopsMap);
  if (hospitalChapin) routes.push(hospitalChapin);
  
  const expressEastCSV = await fetchCSV('Express East.csv');
  const expressEast = parseRouteCSV(expressEastCSV, stopsMap);
  if (expressEast) routes.push(expressEast);
  
  const expressWestCSV = await fetchCSV('Express West.csv');
  const expressWest = parseRouteCSV(expressWestCSV, stopsMap);
  if (expressWest) routes.push(expressWest);
  
  const shoppingRouteEastCSV = await fetchCSV('Shopping Route East.csv');
  const shoppingRouteEast = parseRouteCSV(shoppingRouteEastCSV, stopsMap);
  if (shoppingRouteEast) routes.push(shoppingRouteEast);
  
  const shoppingRouteWestCSV = await fetchCSV('Shopping Route West.csv');
  const shoppingRouteWest = parseRouteCSV(shoppingRouteWestCSV, stopsMap);
  if (shoppingRouteWest) routes.push(shoppingRouteWest);
  
  const railroadCSV = await fetchCSV('Railroad.csv');
  const railroad = parseRouteCSV(railroadCSV, stopsMap);
  if (railroad) routes.push(railroad);
  
  const portJeffersonCSV = await fetchCSV('Port Jefferson.csv');
  const portJefferson = parseRouteCSV(portJeffersonCSV, stopsMap);
  if (portJefferson) routes.push(portJefferson);
  
  const rdParkCSV = await fetchCSV('R&D Park.csv');
  const rdPark = parseRouteCSV(rdParkCSV, stopsMap);
  if (rdPark) routes.push(rdPark);
  
  return routes;
};

// Get a specific route by name
export const getSbuBusRoute = async (routeName: string): Promise<SbuRoute | undefined> => {
  const routes = await getSbuBusRoutes();
  return routes.find(route => route.name.toLowerCase() === routeName.toLowerCase());
};

// Helper function to parse time string to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(s => parseInt(s.trim()));
  return hours * 60 + minutes;
};

// Calculate next bus for all stops in a route
export const getNextBusForRoute = (route: SbuRoute, maxBuses: number = 3): NextBusInfo[] => {
  if (!route.schedule) {
    return route.stops.map(stop => ({
      stopName: stop.name,
      nextBuses: []
    }));
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const nextBusInfos: NextBusInfo[] = [];

  // For each stop in the route
  route.schedule.stopNames.forEach((stopName, stopIndex) => {
    const upcomingBuses: BusArrival[] = [];

    // Look through all runs to find upcoming buses
    for (const run of route.schedule!.runs) {
      if (stopIndex < run.stopTimes.length) {
        const busTime = run.stopTimes[stopIndex];
        if (busTime) {
          const busMinutes = timeToMinutes(busTime);
          
          // If this bus hasn't arrived yet today
          if (busMinutes >= currentMinutes) {
            upcomingBuses.push({
              time: busTime,
              minutesUntil: busMinutes - currentMinutes,
              runNumber: run.runNumber
            });
          }
        }
      }
    }

    // Sort by time and take only the next few buses
    upcomingBuses.sort((a, b) => a.minutesUntil - b.minutesUntil);
    const nextBuses = upcomingBuses.slice(0, maxBuses);

    nextBusInfos.push({
      stopName,
      nextBuses
    });
  });

  return nextBusInfos;
};
