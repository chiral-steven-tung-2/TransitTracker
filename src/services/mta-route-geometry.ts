import L from 'leaflet';
import 'leaflet-routing-machine';

export interface RouteGeometry {
  coordinates: [number, number][];
}

// Cache for route geometries to avoid repeated API calls
const geometryCache = new Map<string, RouteGeometry>();

/**
 * Fetch route geometry that follows roads using OSRM
 */
export async function fetchMTARouteGeometry(
  coordinates: [number, number][]
): Promise<RouteGeometry> {
  // Create a cache key from coordinates
  const cacheKey = JSON.stringify(coordinates);
  
  // Check if we already have this geometry
  if (geometryCache.has(cacheKey)) {
    return geometryCache.get(cacheKey)!;
  }

  return new Promise((resolve, reject) => {
    const waypoints = coordinates.map(coord => 
      L.Routing.waypoint(L.latLng(coord[0], coord[1]))
    );

    const router = L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1'
    });

    router.route(
      waypoints,
      (err: any, routes?: any) => {
        if (err) {
          console.error('Routing error:', err);
          reject(err);
          return;
        }

        if (routes && routes.length > 0) {
          const routeCoordinates = routes[0].coordinates.map((coord: any) => 
            [coord.lat, coord.lng] as [number, number]
          );
          
          const geometry: RouteGeometry = {
            coordinates: routeCoordinates
          };

          // Cache the result
          geometryCache.set(cacheKey, geometry);
          resolve(geometry);
        } else {
          reject(new Error('No routes found'));
        }
      },
      // @ts-ignore - OSRM router context
      null
    );
  });
}

/**
 * Get cached route geometry or fetch if not cached
 */
export async function getCachedMTARouteGeometry(
  coordinates: [number, number][]
): Promise<RouteGeometry> {
  const cacheKey = JSON.stringify(coordinates);
  
  if (geometryCache.has(cacheKey)) {
    return geometryCache.get(cacheKey)!;
  }
  
  return fetchMTARouteGeometry(coordinates);
}

/**
 * Clear the geometry cache
 */
export function clearMTAGeometryCache(): void {
  geometryCache.clear();
}
