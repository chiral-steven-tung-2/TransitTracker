// Service to fetch road-following route geometries
// Uses OSRM (Open Source Routing Machine) - client-side routing

import L from 'leaflet'
import 'leaflet-routing-machine'

export interface RouteGeometry {
  coordinates: [number, number][] // [lat, lng] pairs
}

/**
 * Fetch route geometry that follows roads between multiple points using OSRM
 * @param coordinates Array of [lat, lng] coordinates
 * @returns Promise with route coordinates in [lat, lng] format for Leaflet
 */
export async function fetchRouteGeometry(
  coordinates: [number, number][]
): Promise<RouteGeometry | null> {
  return new Promise((resolve) => {
    try {
      // Create a temporary routing control (we won't add it to the map)
      const waypoints = coordinates.map(coord => L.latLng(coord[0], coord[1]))
      
      const routingControl = L.Routing.control({
        waypoints: waypoints,
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: false,
        lineOptions: {
          styles: [{ color: 'transparent', opacity: 0, weight: 0 }],
          extendToWaypoints: false,
          missingRouteTolerance: 0
        }
      })

      // Listen for routing result
      routingControl.on('routesfound', (e: any) => {
        const route = e.routes[0]
        const routeCoordinates = route.coordinates.map((coord: L.LatLng) => 
          [coord.lat, coord.lng] as [number, number]
        )
        
        resolve({
          coordinates: routeCoordinates
        })
      })

      routingControl.on('routingerror', (e: any) => {
        console.error('Routing error:', e)
        resolve(null)
      })

      // Trigger the routing calculation
      routingControl.route()
    } catch (error) {
      console.error('Error fetching route geometry:', error)
      resolve(null)
    }
  })
}

/**
 * Cache route geometries to avoid repeated calculations
 */
const routeCache = new Map<string, RouteGeometry>()

export async function getCachedRouteGeometry(
  coordinates: [number, number][]
): Promise<RouteGeometry | null> {
  const cacheKey = JSON.stringify(coordinates)
  
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!
  }

  const geometry = await fetchRouteGeometry(coordinates)
  
  if (geometry) {
    routeCache.set(cacheKey, geometry)
  }

  return geometry
}
