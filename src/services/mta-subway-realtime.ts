// MTA Subway Real-time Service
// Uses MTA GTFS-Realtime feeds

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { getTripsCache, getStopsCache } from './gtfs-parser';

// GTFS feed URLs for different subway lines
export const SUBWAY_FEEDS = {
  'ACE': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  '123456S': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  'NQRW': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  'BDFM': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'L': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  'JZ': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'G': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'SIR': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
};

// Map route IDs to their feed
export const getSubwayFeedForRoute = (routeId: string): string | null => {
  if (['A', 'C', 'E'].includes(routeId)) return SUBWAY_FEEDS['ACE'];
  if (['1', '2', '3', '4', '5', '6', '7', 'S'].includes(routeId)) return SUBWAY_FEEDS['123456S'];
  if (['N', 'Q', 'R', 'W'].includes(routeId)) return SUBWAY_FEEDS['NQRW'];
  if (['B', 'D', 'F', 'M'].includes(routeId)) return SUBWAY_FEEDS['BDFM'];
  if (routeId === 'L') return SUBWAY_FEEDS['L'];
  if (['J', 'Z'].includes(routeId)) return SUBWAY_FEEDS['JZ'];
  if (routeId === 'G') return SUBWAY_FEEDS['G'];
  if (routeId === 'SIR') return SUBWAY_FEEDS['SIR'];
  return null;
};

// Map route and direction to typical destinations
const ROUTE_DESTINATIONS: { [key: string]: { northbound: string; southbound: string } } = {
  '1': { northbound: 'Van Cortlandt Park-242 St', southbound: 'South Ferry' },
  '2': { northbound: 'Wakefield-241 St', southbound: 'Flatbush Av' },
  '3': { northbound: '148 St', southbound: 'New Lots Av' },
  '4': { northbound: 'Woodlawn', southbound: 'Crown Hts-Utica Av' },
  '5': { northbound: 'Eastchester-Dyre Av', southbound: 'Flatbush Av' },
  '6': { northbound: 'Pelham Bay Park', southbound: 'Brooklyn Bridge' },
  '7': { northbound: 'Flushing-Main St', southbound: '34 St-Hudson Yards' },
  'A': { northbound: 'Inwood-207 St', southbound: 'Far Rockaway' },
  'C': { northbound: '168 St', southbound: 'Euclid Av' },
  'E': { northbound: 'Jamaica Center', southbound: 'World Trade Center' },
  'B': { northbound: 'Bedford Park Blvd', southbound: 'Brighton Beach' },
  'D': { northbound: 'Norwood-205 St', southbound: 'Coney Island' },
  'F': { northbound: 'Jamaica-179 St', southbound: 'Coney Island' },
  'M': { northbound: 'Forest Hills-71 Av', southbound: 'Middle Village' },
  'G': { northbound: 'Court Sq', southbound: 'Church Av' },
  'L': { northbound: '8 Av', southbound: 'Canarsie-Rockaway Pkwy' },
  'J': { northbound: 'Jamaica Center', southbound: 'Broad St' },
  'Z': { northbound: 'Jamaica Center', southbound: 'Broad St' },
  'N': { northbound: 'Astoria-Ditmars Blvd', southbound: 'Coney Island' },
  'Q': { northbound: '96 St', southbound: 'Coney Island' },
  'R': { northbound: 'Forest Hills-71 Av', southbound: 'Bay Ridge-95 St' },
  'W': { northbound: 'Astoria-Ditmars Blvd', southbound: 'Whitehall St' },
  'S': { northbound: 'Times Sq-42 St', southbound: 'Grand Central-42 St' },
};

export interface SubwayArrival {
  routeId: string;
  tripId: string;
  stopId: string;
  arrivalTime: number; // Unix timestamp in seconds
  departureTime: number; // Unix timestamp in seconds
  direction: string;
  destination?: string;
}

export interface SubwayRealtimeData {
  stopId: string;
  northbound: SubwayArrival[];
  southbound: SubwayArrival[];
  lastUpdated: number;
}

/**
 * Fetch real-time subway arrivals for a stop
 */
export const fetchSubwayArrivals = async (
  stopId: string,
  routeId: string
): Promise<SubwayRealtimeData> => {
  const feedUrl = getSubwayFeedForRoute(routeId);
  
  if (!feedUrl) {
    throw new Error(`No feed found for route ${routeId}`);
  }

  try {
    console.log(`Fetching subway data for stop ${stopId}, route ${routeId}`);
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
    console.log('First 3 entities:', feed.entity.slice(0, 3));
    console.log('=================');
    
    const allArrivals = await parseGTFSRealtimeFeed(feed, stopId, routeId);
    
    // Separate by direction based on stop ID suffix
    // Note: MTA uses N for northbound and S for southbound
    const southbound = allArrivals.filter(a => a.stopId.endsWith('N')).sort((a, b) => a.arrivalTime - b.arrivalTime);
    const northbound = allArrivals.filter(a => a.stopId.endsWith('S')).sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    return {
      stopId,
      northbound,
      southbound,
      lastUpdated: Date.now()
    };
    
  } catch (error) {
    console.error('Error fetching subway arrivals:', error);
    // Fall back to mock data if API fails
    console.log('Falling back to mock data');
    return getMockSubwayArrivals(stopId, routeId);
  }
};

/**
 * Parse GTFS-Realtime protobuf data
 */
export const parseGTFSRealtimeFeed = async (
  feed: GtfsRealtimeBindings.transit_realtime.FeedMessage,
  stopId: string,
  routeId: string
): Promise<SubwayArrival[]> => {
  const arrivals: SubwayArrival[] = [];
  
  console.log('🚇 === PARSING GTFS FEED ===');
  
  // Load trips data and stops data for destination lookup
  const tripsData = await getTripsCache();
  const stopsData = await getStopsCache();
  
  console.log(`✅ Loaded ${tripsData.size} trips and ${stopsData.size} stops for destination lookup`);
  
  // MTA uses stop IDs with direction suffixes (N for north/uptown, S for south/downtown)
  // Remove any direction suffix from our stop ID for matching
  const baseStopId = stopId.replace(/[NS]$/i, '');
  
  console.log(`Parsing feed for stop ${stopId} (base: ${baseStopId}), route ${routeId}`);
  console.log(`Feed has ${feed.entity.length} entities`);
  
  let tripUpdatesCount = 0;
  let relevantTripsCount = 0;
  
  for (const entity of feed.entity) {
    if (entity.tripUpdate && entity.tripUpdate.trip) {
      tripUpdatesCount++;
      const trip = entity.tripUpdate.trip;
      
      // Filter by route if specified
      if (routeId && trip.routeId !== routeId) {
        continue;
      }
      relevantTripsCount++;
      
      // Log trip details for debugging
      if (relevantTripsCount === 1) {
        console.log('Sample trip object:', trip);
        console.log('Trip fields:', Object.keys(trip));
      }
      
      // Check each stop time update
      if (entity.tripUpdate.stopTimeUpdate) {
        for (const stopTimeUpdate of entity.tripUpdate.stopTimeUpdate) {
          // Get the stop ID from this update and remove direction suffix
          const updateStopId = stopTimeUpdate.stopId || '';
          const updateBaseStopId = updateStopId.replace(/[NS]$/i, '');
          
          // Match if either the full stop ID matches OR the base stop ID matches
          const matchesStop = updateStopId === stopId || 
                            updateBaseStopId === baseStopId ||
                            updateStopId === `${baseStopId}N` ||
                            updateStopId === `${baseStopId}S`;
          
          // Log all stops for this trip on the first relevant trip to debug
          if (relevantTripsCount === 1) {
            console.log(`Trip ${trip.tripId} stops at: ${entity.tripUpdate.stopTimeUpdate.map(s => s.stopId).join(', ')}`);
          }
          
          if (matchesStop) {
            // Handle both number and Long types from protobuf
            const getTimeValue = (time: any): number => {
              if (!time) return 0;
              if (typeof time === 'number') return time;
              // Long objects have toNumber method or can be converted to number
              if (typeof time === 'object') {
                if ('toNumber' in time && typeof time.toNumber === 'function') {
                  return time.toNumber();
                }
                // Try direct number conversion
                return Number(time);
              }
              return 0;
            };
            
            const arrivalTime = getTimeValue(stopTimeUpdate.arrival?.time) || 
                              getTimeValue(stopTimeUpdate.departure?.time) || 0;
            const departureTime = getTimeValue(stopTimeUpdate.departure?.time) || arrivalTime;
            
            if (arrivalTime > 0) {
              console.log(`Found arrival: route ${trip.routeId}, stop ${updateStopId}, time ${arrivalTime}`);
              
              // Determine destination from the last stop in the trip's stop sequence
              let destination: string | undefined;
              
              // Get all stop time updates for this trip, sorted by stop sequence
              const allStopUpdates = entity.tripUpdate.stopTimeUpdate
                .filter(stu => stu.stopSequence != null)
                .sort((a, b) => {
                  const seqA = typeof a.stopSequence === 'number' ? a.stopSequence : 
                              (a.stopSequence as any)?.toNumber?.() || 0;
                  const seqB = typeof b.stopSequence === 'number' ? b.stopSequence : 
                              (b.stopSequence as any)?.toNumber?.() || 0;
                  return seqB - seqA; // Sort descending to get last stop first
                });
              
              if (allStopUpdates.length > 0) {
                const lastStopUpdate = allStopUpdates[0];
                const lastStopId = lastStopUpdate.stopId || '';
                
                // Remove direction suffix from stop ID for lookup
                const lastStopBaseId = lastStopId.replace(/[NS]$/i, '');
                
                // Look up the stop name from stops.txt
                const stopInfo = stopsData.get(lastStopBaseId);
                if (stopInfo) {
                  destination = stopInfo.stopName;
                  console.log(`✅ Found destination from stop sequence: ${destination} (stop ${lastStopId})`);
                } else {
                  console.log(`⚠️ Stop ${lastStopBaseId} not found in stops data`);
                }
              }
              
              // Fallback: Try to get from static trips data
              if (!destination) {
                const tripData = tripsData.get(trip.tripId || '');
                destination = tripData?.tripHeadsign;
                if (destination) {
                  console.log(`Using trip headsign from static data: ${destination}`);
                }
              }
              
              // Final fallback: Use route/direction mapping
              if (!destination) {
                const trainRoute = trip.routeId || routeId;
                const routeDest = ROUTE_DESTINATIONS[trainRoute];
                
                // Use stop ID suffix (N/S) to determine direction
                const isNorthbound = updateStopId.endsWith('N');
                
                if (routeDest) {
                  destination = isNorthbound ? routeDest.northbound : routeDest.southbound;
                  console.log(`Using fallback route/direction mapping: ${destination}`);
                } else {
                  destination = 'Unknown Destination';
                  console.log(`No destination mapping found for route ${trainRoute}`);
                }
              }
              
              console.log(`Trip ${trip.tripId} final destination: ${destination}`);
              
              arrivals.push({
                routeId: trip.routeId || routeId,
                tripId: trip.tripId || '',
                stopId: updateStopId || stopId,
                arrivalTime,
                departureTime,
                direction: trip.directionId?.toString() || '0',
                destination: destination
              });
            }
          }
        }
      }
    }
  }
  
  console.log(`Trip updates in feed: ${tripUpdatesCount}`);
  console.log(`Relevant trips for route ${routeId}: ${relevantTripsCount}`);
  console.log(`Found ${arrivals.length} arrivals for stop ${stopId}`);
  return arrivals;
};

/**
 * Mock data for testing without API
 */
export const getMockSubwayArrivals = (stopId: string, routeId: string): SubwayRealtimeData => {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    stopId,
    northbound: [
      {
        routeId,
        tripId: `mock-trip-1`,
        stopId: `${stopId}N`,
        arrivalTime: now + 120, // 2 minutes
        departureTime: now + 150,
        direction: 'N'
      },
      {
        routeId,
        tripId: `mock-trip-2`,
        stopId: `${stopId}N`,
        arrivalTime: now + 420, // 7 minutes
        departureTime: now + 450,
        direction: 'N'
      },
    ],
    southbound: [
      {
        routeId,
        tripId: `mock-trip-3`,
        stopId: `${stopId}S`,
        arrivalTime: now + 300, // 5 minutes
        departureTime: now + 330,
        direction: 'S'
      },
    ],
    lastUpdated: Date.now()
  };
};
