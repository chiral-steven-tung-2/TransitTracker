import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

import { fetchNYCTBusRoutesData, fetchBCBusRoutesData } from '../../services/mta-bus-routes'
import type { CleanedRoutesData, RouteData } from '../../services/mta-bus-routes';
import type { CleanedBusStopsData } from '../../services/mta-bus-stops';
import { fetchMTABusData, type CleanedBusData } from '../../services/mta-live-bus';
import { getCachedMTARouteGeometry, type RouteGeometry } from '../../services/mta-route-geometry';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

// Create custom colored circle markers (same style as SBU bus map)
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

// Determine bus route color based on type in destination name
const getBusRouteColor = (destinationName: string): string => {
  const upperDest = destinationName.toUpperCase();
  
  if (upperDest.includes('RUSH')) {
    return '#9333ea'; // Purple
  } else if (upperDest.includes('LIMITED')) {
    return '#dc2626'; // Red
  } else if (upperDest.includes('SELECT BUS') || upperDest.includes('SBS')) {
    return '#2563eb'; // Blue
  } else {
    return '#16a34a'; // Green (Local - default)
  }
}

export default function BusPage() {
  // Default center (New York City as an example - you can change this)
  const defaultCenter: [number, number] = [40.7128, -74.0060]
  const [routesData, setRoutesData] = useState<CleanedRoutesData | null>(null)
  const [selectedBorough, setSelectedBorough] = useState<string>('')
  const [selectedRoute, setSelectedRoute] = useState<string>('')
  const [availableRoutes, setAvailableRoutes] = useState<RouteData[]>([])
  const [activeTab, setActiveTab] = useState<string>('search')
  const [hasLoadedRoutes, setHasLoadedRoutes] = useState<boolean>(false)
  const [busStopsData, setBusStopsData] = useState<CleanedBusStopsData | null>(null)
  const [isLoadingStops, setIsLoadingStops] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)
  const [liveBusData, setLiveBusData] = useState<CleanedBusData | null>(null)
  const [isLoadingLiveBus, setIsLoadingLiveBus] = useState(false)
  const [testStopId, setTestStopId] = useState<string>('502185')
  const [selectedDirection, setSelectedDirection] = useState<'0' | '1'>('0')
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | null>(null)

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

  // Only load routes data once, when Search tab is selected for the first time
  useEffect(() => {
    if (activeTab === 'search' && !hasLoadedRoutes) {
      const loadData = async () => {
        try {
          const nyctData = await fetchNYCTBusRoutesData()
          const bcData = await fetchBCBusRoutesData()
          // Concatenate lists for unified city-wide routes
          const merged: CleanedRoutesData = {
            manhattanReg: [...nyctData.manhattanReg, ...bcData.manhattanReg],
            queensReg: [...nyctData.queensReg, ...bcData.queensReg],
            bronxReg: [...nyctData.bronxReg, ...bcData.bronxReg],
            brooklynReg: [...nyctData.brooklynReg, ...bcData.brooklynReg],
            statenislandReg: [...nyctData.statenislandReg, ...bcData.statenislandReg],
            xExp: [...nyctData.xExp, ...bcData.xExp],
            queensExp: [...nyctData.queensExp, ...bcData.queensExp],
            bronxExp: [...nyctData.bronxExp, ...bcData.bronxExp],
            brooklynExp: [...nyctData.brooklynExp, ...bcData.brooklynExp],
            statenislandExp: [...nyctData.statenislandExp, ...bcData.statenislandExp],
            shuttles: [...nyctData.shuttles, ...bcData.shuttles],
          }
          setRoutesData(merged)
          setHasLoadedRoutes(true)
        } catch (err) {
          console.error('Error loading routes data:', err)
        }
      }
      loadData()
    }
  }, [activeTab, hasLoadedRoutes])

  useEffect(() => {
    // Update available routes when borough changes
    if (routesData && selectedBorough) {
      const boroughKey = selectedBorough as keyof CleanedRoutesData
      setAvailableRoutes(routesData[boroughKey] || [])
      setSelectedRoute('') // Reset route selection
    } else {
      setAvailableRoutes([])
    }
  }, [selectedBorough, routesData])

  // Fetch route geometry when stops data or direction changes
  useEffect(() => {
    const fetchGeometry = async () => {
      if (!busStopsData) {
        setRouteGeometry(null);
        return;
      }

      const stopsToUse = selectedDirection === '0' 
        ? busStopsData.zeroDirStopsData 
        : busStopsData.oneDirStopsData;

      if (stopsToUse.length < 2) {
        setRouteGeometry(null);
        return;
      }

      try {
        const coordinates = stopsToUse.map(stop => [stop.latitude, stop.longitude] as [number, number]);
        const geometry = await getCachedMTARouteGeometry(coordinates);
        setRouteGeometry(geometry);
      } catch (error) {
        console.error('Error fetching route geometry:', error);
        setRouteGeometry(null);
      }
    };

    fetchGeometry();
  }, [busStopsData, selectedDirection]);

  const handleSearch = async () => {
    if (selectedBorough && selectedRoute) {
      setIsLoadingStops(true);
      setBusStopsData(null);
      try {
        const data = await import('../../services/mta-bus-stops');
        const result = await data.fetchBusStopsData(selectedRoute);
        setBusStopsData(result);
        console.log('Bus stops for route', selectedRoute, result);
      } catch (err) {
        console.error('Error fetching bus stops:', err);
      } finally {
        setIsLoadingStops(false);
      }
    }
  }

  const handleTestLiveBus = async () => {
    setIsLoadingLiveBus(true);
    setLiveBusData(null);
    try {
      const result = await fetchMTABusData(testStopId);
      setLiveBusData(result);
      console.log('Live bus data for stop', testStopId, result);
    } catch (err) {
      console.error('Error fetching live bus data:', err);
    } finally {
      setIsLoadingLiveBus(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row w-full" style={{ height: 'calc(100vh - 73px)' }}>
      {/* Map - Top on mobile, Left on desktop */}
      <div className="w-full lg:w-1/2 h-[50vh] lg:h-full order-1 lg:order-1 relative z-0">
        <MapContainer
          center={defaultCenter}
          zoom={12}
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
          
          {/* Display route stops and line */}
          {busStopsData && (() => {
            const stopsToDisplay = selectedDirection === '0' 
              ? busStopsData.zeroDirStopsData 
              : busStopsData.oneDirStopsData;
            
            // Determine the color based on the destination
            const destinationName = selectedDirection === '0' 
              ? busStopsData.zeroDirDest 
              : busStopsData.oneDirDest;
            const routeColor = getBusRouteColor(destinationName);
            
            return (
              <>
                {/* Markers for each stop */}
                {stopsToDisplay.map((stop, index) => (
                  <Marker 
                    key={stop.id} 
                    position={[stop.latitude, stop.longitude]}
                    icon={createCustomIcon(routeColor)}
                  >
                    <Popup>
                      <strong>Stop {index + 1}: {stop.name}</strong>
                      <br />
                      ID: {stop.id}
                      <br />
                      Direction: {stop.direction}
                    </Popup>
                  </Marker>
                ))}
                
                {/* Polyline connecting stops following roads */}
                {stopsToDisplay.length > 1 && routeGeometry && (
                  <Polyline
                    positions={routeGeometry.coordinates}
                    color={routeColor}
                    weight={5}
                    opacity={0.8}
                  />
                )}
                
                {/* Fallback: straight line if geometry not loaded */}
                {stopsToDisplay.length > 1 && !routeGeometry && (
                  <Polyline
                    positions={stopsToDisplay.map(stop => [stop.latitude, stop.longitude] as [number, number])}
                    color={routeColor}
                    weight={5}
                    opacity={0.5}
                    dashArray="10, 10"
                  />
                )}
              </>
            );
          })()}
        </MapContainer>
      </div>

      {/* Content - Bottom on mobile, Right on desktop */}
      <div className="w-full lg:w-1/2 h-[50vh] lg:h-full p-4 lg:p-8 bg-background overflow-y-auto order-2 lg:order-2 relative z-10">
        <h1 className="text-4xl font-semibold text-foreground mb-4">
          Bus Routes
        </h1>

        

        <Tabs defaultValue="search" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="closest">Closest</TabsTrigger>
            <TabsTrigger value="test">Test Live</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Borough</label>
                <Select value={selectedBorough} onValueChange={setSelectedBorough} disabled={!routesData}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={routesData ? "Select Borough" : "Loading..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manhattanReg">Manhattan (Regular)</SelectItem>
                    <SelectItem value="queensReg">Queens (Regular)</SelectItem>
                    <SelectItem value="bronxReg">Bronx (Regular)</SelectItem>
                    <SelectItem value="brooklynReg">Brooklyn (Regular)</SelectItem>
                    <SelectItem value="statenislandReg">Staten Island (Regular)</SelectItem>
                    <SelectItem value="xExp">Express (X)</SelectItem>
                    <SelectItem value="queensExp">Queens (Express)</SelectItem>
                    <SelectItem value="bronxExp">Bronx (Express)</SelectItem>
                    <SelectItem value="brooklynExp">Brooklyn (Express)</SelectItem>
                    <SelectItem value="statenislandExp">Staten Island (Express)</SelectItem>
                    <SelectItem value="shuttles">Shuttles</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Choose Route</label>
                <Select 
                  value={selectedRoute} 
                  onValueChange={setSelectedRoute}
                  disabled={!selectedBorough || !routesData || availableRoutes.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={!selectedBorough ? "Select Borough First" : availableRoutes.length === 0 ? "No Routes" : "Choose Route"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.shortName} - {route.longName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleSearch}
                disabled={!selectedBorough || !selectedRoute || isLoadingStops}
              >
                {isLoadingStops ? 'Loading...' : 'Search'}
              </Button>
              {!routesData && (
                <div className="text-center text-muted-foreground text-sm mt-2">Loading routes...</div>
              )}
            </div>
            
            {/* Direction selection and stops display */}
            {busStopsData && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Direction</label>
                  <Select value={selectedDirection} onValueChange={(val) => setSelectedDirection(val as '0' | '1')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">
                        Direction 0: {busStopsData.zeroDirDest}
                      </SelectItem>
                      <SelectItem value="1">
                        Direction 1: {busStopsData.oneDirDest}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-3">
                    Route: {busStopsData.route}
                  </h2>
                  <h3 className="font-medium mb-2">
                    {selectedDirection === '0' ? busStopsData.zeroDirDest : busStopsData.oneDirDest}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedDirection === '0' 
                      ? `${busStopsData.zeroDirStopsData.length} stops` 
                      : `${busStopsData.oneDirStopsData.length} stops`}
                  </p>
                  <ul className="space-y-1 max-h-64 overflow-y-auto">
                    {(selectedDirection === '0' 
                      ? busStopsData.zeroDirStopsData 
                      : busStopsData.oneDirStopsData
                    ).map((stop, index) => (
                      <li key={stop.id} className="text-sm p-2 hover:bg-accent rounded">
                        {index + 1}. {stop.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="closest" className="mt-4">
            <p className="text-muted-foreground">In the Closest view</p>
          </TabsContent>
          <TabsContent value="test" className="mt-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Test Stop ID</label>
                <input
                  type="text"
                  value={testStopId}
                  onChange={(e) => setTestStopId(e.target.value)}
                  placeholder="Enter stop ID (e.g., 502185)"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <Button 
                onClick={handleTestLiveBus}
                disabled={isLoadingLiveBus || !testStopId}
                className="w-full"
              >
                {isLoadingLiveBus ? 'Loading...' : 'Fetch Live Bus Data'}
              </Button>

              {liveBusData && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 border rounded-lg bg-card">
                    <h3 className="font-semibold text-lg mb-2">Data Received: {liveBusData.DataReceivedTime}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Found {liveBusData.MonitoredStopVisit.length} buses
                    </p>
                  </div>

                  {liveBusData.MonitoredStopVisit.length > 0 ? (
                    <div className="space-y-3">
                      {liveBusData.MonitoredStopVisit.map((bus, index) => (
                        <div 
                          key={index}
                          className="p-4 border rounded-lg bg-card space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-lg">Bus {bus.PublishedLineName}</h4>
                              <p className="text-sm text-muted-foreground">
                                To: {bus.DestinationName}
                              </p>
                              <p className="text-sm">
                                Vehicle: #{bus.VehicleNumber}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">{bus.PresentableDistance}</p>
                              <p className="text-sm text-muted-foreground">{bus.StopsFromCall} stops</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                            <div>
                              <p className="text-muted-foreground">Expected Arrival:</p>
                              <p className="font-medium">{bus.ExpectedArrivalTime}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Expected Departure:</p>
                              <p className="font-medium">{bus.ExpectedDepartureTime}</p>
                            </div>
                          </div>

                          {(bus.EstimatedPassengerCount > 0 || bus.EstimatedPassengerCapacity > 0) && (
                            <div className="pt-2 border-t text-sm">
                              <p className="text-muted-foreground">
                                Capacity: {bus.EstimatedPassengerCount} / {bus.EstimatedPassengerCapacity} passengers
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2 text-xs">
                            <span className={`px-2 py-1 rounded ${bus.Monitored ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-gray-500/20 text-gray-700 dark:text-gray-300'}`}>
                              {bus.Monitored ? 'Tracked' : 'Not Tracked'}
                            </span>
                            {bus.StrollerVehicle && (
                              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                Stroller Accessible
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 border rounded-lg text-center text-muted-foreground">
                      No buses currently serving this stop
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
