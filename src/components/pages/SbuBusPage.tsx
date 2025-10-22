import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import L from 'leaflet'
import React from 'react'

// Fix for default marker icons in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Button } from '../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getSbuBusRoutes, getNextBusForRoute, type SbuRoute, type NextBusInfo } from '../../services/sbu-bus-service'
import { getCachedRouteGeometry, type RouteGeometry } from '../../services/route-geometry'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

// Create custom colored circle markers
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background-color: white;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

export default function SbuBusPage() {
  // Default center (Stony Brook University)
  const defaultCenter: [number, number] = [40.9124, -73.1237]
  const [routes, setRoutes] = useState<SbuRoute[]>([])
  const [selectedRoute, setSelectedRoute] = useState<string>('')
  const [currentRoute, setCurrentRoute] = useState<SbuRoute | null>(null)
  const [nextBusInfo, setNextBusInfo] = useState<NextBusInfo[]>([])
  const [activeTab, setActiveTab] = useState<string>('route')
  const [selectedStop, setSelectedStop] = useState<string>('')
  const [routeGeometries, setRouteGeometries] = useState<Map<string, RouteGeometry>>(new Map())
  const [returnGeometries, setReturnGeometries] = useState<Map<string, RouteGeometry>>(new Map())
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set())
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)
  const [openRouteCombobox, setOpenRouteCombobox] = useState(false)
  const [openStopCombobox, setOpenStopCombobox] = useState(false)

  // Check for dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    
    // Initial check
    checkDarkMode()
    
    // Watch for changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])

  // Load routes on mount
  useEffect(() => {
    const sbuRoutes = getSbuBusRoutes()
    setRoutes(sbuRoutes)
    // Initialize all routes as visible
    setVisibleRoutes(new Set(sbuRoutes.map(r => r.name)))
  }, [])

  // Update current route when selection changes
  useEffect(() => {
    if (selectedRoute) {
      const route = routes.find(r => r.name === selectedRoute)
      setCurrentRoute(route || null)
      
      // Calculate next bus times
      if (route) {
        const nextBuses = getNextBusForRoute(route)
        setNextBusInfo(nextBuses)
        
        // Fetch road-following geometry for the route
        if (!routeGeometries.has(route.name)) {
          const coordinates = route.stops.map(stop => [stop.latitude, stop.longitude] as [number, number])
          getCachedRouteGeometry(coordinates).then(geometry => {
            if (geometry) {
              setRouteGeometries(prev => new Map(prev).set(route.name, geometry))
            }
          })
        }
        
        // Fetch road-following geometry for the return path (last stop to first stop)
        if (!returnGeometries.has(route.name) && route.stops.length > 1) {
          const lastStop = route.stops[route.stops.length - 1]
          const firstStop = route.stops[0]
          const returnCoordinates: [number, number][] = [
            [lastStop.latitude, lastStop.longitude],
            [firstStop.latitude, firstStop.longitude]
          ]
          getCachedRouteGeometry(returnCoordinates).then(geometry => {
            if (geometry) {
              setReturnGeometries(prev => new Map(prev).set(route.name, geometry))
            }
          })
        }
      }
    } else {
      setCurrentRoute(null)
      setNextBusInfo([])
    }
  }, [selectedRoute, routes, routeGeometries, returnGeometries])
  
  // Update next bus info every minute
  useEffect(() => {
    if (currentRoute) {
      const interval = setInterval(() => {
        const nextBuses = getNextBusForRoute(currentRoute)
        setNextBusInfo(nextBuses)
      }, 60000) // Update every 60 seconds
      
      return () => clearInterval(interval)
    }
  }, [currentRoute])

  // Get route color for map
  const getRouteColor = (color: string): string => {
    const colorMap: Record<string, string> = {
      'orange': '#ff8c00',
      'green': '#00cc00',
      'purple': '#9b59b6',
      'blue': '#0066ff',
      'red': '#dc3545',
      'pink': '#ff69b4',
      'turquoise': '#40e0d0',
      'black': '#2c3e50',
      'yellow': '#ffd700',
      'beige': '#d4a574',
    }
    return colorMap[color.toLowerCase()] || '#0000ff'
  }

  // Toggle route visibility
  const toggleRouteVisibility = (routeName: string) => {
    setVisibleRoutes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(routeName)) {
        newSet.delete(routeName)
      } else {
        newSet.add(routeName)
      }
      return newSet
    })
  }

  // Get routes that pass through the selected stop (filtered by visibility)
  const routesAtSelectedStop = activeTab === 'stop' && selectedStop
    ? routes.filter(route => 
        route.stops.some(stop => stop.name === selectedStop) && 
        visibleRoutes.has(route.name)
      )
    : []

  // Fetch geometries for routes at selected stop
  useEffect(() => {
    if (activeTab === 'stop' && selectedStop && routesAtSelectedStop.length > 0) {
      routesAtSelectedStop.forEach(route => {
        if (!routeGeometries.has(route.name)) {
          const coordinates = route.stops.map(stop => [stop.latitude, stop.longitude] as [number, number])
          getCachedRouteGeometry(coordinates).then(geometry => {
            if (geometry) {
              setRouteGeometries(prev => new Map(prev).set(route.name, geometry))
            }
          })
        }
        
        // Fetch return path geometry
        if (!returnGeometries.has(route.name) && route.stops.length > 1) {
          const lastStop = route.stops[route.stops.length - 1]
          const firstStop = route.stops[0]
          const returnCoordinates: [number, number][] = [
            [lastStop.latitude, lastStop.longitude],
            [firstStop.latitude, firstStop.longitude]
          ]
          getCachedRouteGeometry(returnCoordinates).then(geometry => {
            if (geometry) {
              setReturnGeometries(prev => new Map(prev).set(route.name, geometry))
            }
          })
        }
      })
    }
  }, [activeTab, selectedStop, routesAtSelectedStop, routeGeometries, returnGeometries])

  return (
    <div className="flex flex-col lg:flex-row w-full" style={{ height: 'calc(100vh - 73px)' }}>
      {/* Map - Top on mobile, Left on desktop */}
      <div className="w-full lg:w-1/2 h-[50vh] lg:h-full order-1 lg:order-1 relative z-0">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={
              isDarkMode
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            }
            key={isDarkMode ? 'dark' : 'light'}
          />
          
          {/* Display route markers and line for "Search by Route" tab */}
          {activeTab === 'route' && currentRoute && currentRoute.stops.map((stop, index) => (
            <Marker 
              key={`${stop.name}-${index}`} 
              position={[stop.latitude, stop.longitude]}
              icon={createCustomIcon(getRouteColor(currentRoute.color))}
            >
              <Popup>
                <strong>{stop.name}</strong>
                <br />
                Stop {index + 1} of {currentRoute.stops.length}
              </Popup>
            </Marker>
          ))}
          
          {/* Draw line connecting stops for "Search by Route" tab */}
          {activeTab === 'route' && currentRoute && currentRoute.stops.length > 1 && (
            <Polyline
              key={`${currentRoute.name}-${currentRoute.color}`}
              positions={
                routeGeometries.has(currentRoute.name) && returnGeometries.has(currentRoute.name)
                  ? [...routeGeometries.get(currentRoute.name)!.coordinates, ...returnGeometries.get(currentRoute.name)!.coordinates]
                  : [...currentRoute.stops.map(stop => [stop.latitude, stop.longitude] as [number, number]), [currentRoute.stops[0].latitude, currentRoute.stops[0].longitude] as [number, number]]
              }
              color={getRouteColor(currentRoute.color)}
              weight={5}
              opacity={0.8}
            />
          )}
          
          {/* Display all routes that pass through selected stop for "Search by Stop" tab */}
          {activeTab === 'stop' && selectedStop && routesAtSelectedStop.map((route) => (
            <React.Fragment key={route.name}>
              {/* Markers for all stops on routes passing through selected stop */}
              {route.stops.map((stop, index) => (
                <Marker 
                  key={`${route.name}-${stop.name}-${index}`} 
                  position={[stop.latitude, stop.longitude]}
                  icon={createCustomIcon(getRouteColor(route.color))}
                >
                  <Popup>
                    <strong>{stop.name}</strong>
                    <br />
                    Route: {route.name}
                    <br />
                    Stop {index + 1} of {route.stops.length}
                  </Popup>
                </Marker>
              ))}
              
              {/* Polyline for each route */}
              {route.stops.length > 1 && (
                <Polyline
                  key={`${route.name}-${route.color}`}
                  positions={
                    routeGeometries.has(route.name) && returnGeometries.has(route.name)
                      ? [...routeGeometries.get(route.name)!.coordinates, ...returnGeometries.get(route.name)!.coordinates]
                      : [...route.stops.map(stop => [stop.latitude, stop.longitude] as [number, number]), [route.stops[0].latitude, route.stops[0].longitude] as [number, number]]
                  }
                  color={getRouteColor(route.color)}
                  weight={5}
                  opacity={0.8}
                />
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {/* Content - Bottom on mobile, Right on desktop */}
      <div className="w-full lg:w-1/2 h-[50vh] lg:h-full p-4 lg:p-8 bg-background overflow-y-auto order-2 lg:order-2 relative z-10">
        <h1 className="text-2xl font-bold mb-4">SBU Bus</h1>
        
        {/* Tabs for Search by Route or Stop */}
        <Tabs defaultValue="route" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="route">Search by Route</TabsTrigger>
            <TabsTrigger value="stop">Search by Stop</TabsTrigger>
          </TabsList>

          {/* Search by Route Tab */}
          <TabsContent value="route">
            {/* Route Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Route</label>
              <Popover open={openRouteCombobox} onOpenChange={setOpenRouteCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openRouteCombobox}
                    className="w-full justify-between"
                  >
                    {selectedRoute
                      ? routes.find((route) => route.name === selectedRoute)?.name
                      : "Choose a route"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search routes..." />
                    <CommandList>
                      <CommandEmpty>No route found.</CommandEmpty>
                      <CommandGroup>
                        {routes.map((route) => (
                          <CommandItem
                            key={route.name}
                            value={route.name}
                            onSelect={(currentValue) => {
                              setSelectedRoute(currentValue === selectedRoute ? "" : currentValue)
                              setOpenRouteCombobox(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedRoute === route.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {route.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Display route information */}
            {currentRoute && (
              <div>
                <h2 className="text-xl font-semibold mb-3">
                  {currentRoute.name}
                </h2>
                
                <h3 className="text-lg font-medium mb-2">Stops ({currentRoute.stops.length})</h3>
                <div className="space-y-0">
                  {currentRoute.stops.map((stop, index) => {
                    const nextBusData = nextBusInfo.find(info => info.stopName === stop.name);
                    const buses = nextBusData?.nextBuses || [];
                    
                    return (
                      <div 
                        key={`${stop.name}-${index}`}
                        className="p-3 border rounded-lg transition-colors"
                        style={{ 
                          backgroundColor: getRouteColor(currentRoute.color) + '20',
                          borderColor: getRouteColor(currentRoute.color)
                        }}
                      >
                        <div className="flex justify-between items-center gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-semibold">{index + 1}. {stop.name}</div>
                          </div>
                          
                          {/* Next Buses Info */}
                          <div className="text-right whitespace-nowrap">
                            {buses.length > 0 ? (
                              <div className="text-sm font-bold text-primary">
                                {buses.map((bus) => (
                                  bus.minutesUntil >= 0 ? (
                                    bus.minutesUntil === 0 ? 'Now' : bus.minutesUntil
                                  ) : null
                                )).filter(val => val !== null).join(' | ')} Minutes Away
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground italic">
                                No buses
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Search by Stop Tab */}
          <TabsContent value="stop">
            {/* Stop Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Stop</label>
              <Popover open={openStopCombobox} onOpenChange={setOpenStopCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStopCombobox}
                    className="w-full justify-between"
                  >
                    {selectedStop || "Choose a stop"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search stops..." />
                    <CommandList>
                      <CommandEmpty>No stop found.</CommandEmpty>
                      <CommandGroup>
                        {/* Get all unique stops from all routes */}
                        {Array.from(new Set(routes.flatMap(route => route.stops.map(stop => stop.name)))).sort().map((stopName) => (
                          <CommandItem
                            key={stopName}
                            value={stopName}
                            onSelect={(currentValue) => {
                              setSelectedStop(currentValue === selectedStop ? "" : currentValue)
                              setOpenStopCombobox(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedStop === stopName ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {stopName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Display stop information */}
            {selectedStop && (
              <div>
                <h2 className="text-xl font-semibold mb-3">{selectedStop}</h2>
                
                {/* Route Filter Toggles */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Filter Routes</label>
                  <div className="flex flex-wrap gap-2">
                    {routes
                      .filter(route => route.stops.some(stop => stop.name === selectedStop))
                      .map((route) => (
                        <button
                          key={route.name}
                          onClick={() => toggleRouteVisibility(route.name)}
                          className={`px-3 py-1.5 rounded-md border-2 transition-all text-sm font-medium ${
                            visibleRoutes.has(route.name)
                              ? 'opacity-100 shadow-sm'
                              : 'opacity-40 border-dashed'
                          }`}
                          style={{
                            backgroundColor: visibleRoutes.has(route.name) 
                              ? getRouteColor(route.color) + '30' 
                              : 'transparent',
                            borderColor: getRouteColor(route.color),
                            color: visibleRoutes.has(route.name)
                              ? getRouteColor(route.color)
                              : 'currentColor'
                          }}
                        >
                          {route.name}
                        </button>
                      ))}
                  </div>
                </div>
                
                <p className="text-muted-foreground mb-4">Upcoming buses in arrival order.</p>
                
                <div>
                  {/* Flatten all buses from all routes and sort by arrival time */}
                  {routes
                    .filter(route => 
                      route.stops.some(stop => stop.name === selectedStop) &&
                      visibleRoutes.has(route.name)
                    )
                    .flatMap((route) => {
                      const nextBusesData = getNextBusForRoute(route);
                      const stopNextBus = nextBusesData.find(info => info.stopName === selectedStop);
                      const buses = stopNextBus?.nextBuses || [];
                      
                      // Return array of objects with route and bus info
                      return buses.map(bus => ({ route, bus }));
                    })
                    .sort((a, b) => a.bus.minutesUntil - b.bus.minutesUntil)
                    .map(({ route, bus }, index) => (
                      <div 
                        key={`${route.name}-${index}`}
                        className="p-3 border rounded-lg transition-colors"
                        style={{ 
                          backgroundColor: getRouteColor(route.color) + '20',
                          borderColor: getRouteColor(route.color)
                        }}
                      >
                        <div className="flex justify-between items-center gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-semibold">
                              {route.name}
                            </div>
                          </div>
                          
                          {/* Bus Arrival Info */}
                          <div className="text-right whitespace-nowrap">
                            <div className="text-sm font-bold text-primary">
                              {bus.minutesUntil > 0 ? (
                                <span>{bus.minutesUntil} Minutes Away</span>
                              ) : bus.minutesUntil === 0 ? (
                                <span className="text-green-600">Now</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {/* Show message if no buses */}
                  {routes.filter(route => 
                      route.stops.some(stop => stop.name === selectedStop) &&
                      visibleRoutes.has(route.name)
                    )
                    .flatMap((route) => {
                      const nextBusesData = getNextBusForRoute(route);
                      const stopNextBus = nextBusesData.find(info => info.stopName === selectedStop);
                      return stopNextBus?.nextBuses || [];
                    }).length === 0 && (
                    <div className="p-4 border rounded-lg text-center">
                      <div className="text-base text-muted-foreground italic">
                        {visibleRoutes.size === 0 
                          ? 'Please select at least one route to view buses'
                          : 'No more buses today'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
