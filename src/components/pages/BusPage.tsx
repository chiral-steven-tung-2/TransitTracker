import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import { useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Eye, RefreshCw, MapPin, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../ui/resizable'

import { fetchNYCTBusRoutesData, fetchBCBusRoutesData } from '../../services/mta-bus-routes'
import type { CleanedRoutesData, RouteData } from '../../services/mta-bus-routes';
import type { CleanedBusStopsData, NearbyStop } from '../../services/mta-bus-stops';
import { fetchMTABusData, type CleanedBusData } from '../../services/mta-live-bus';
import { getCachedMTARouteGeometry, type RouteGeometry } from '../../services/mta-route-geometry';
import { fetchStopsForLocation } from '../../services/mta-bus-stops';

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

// Create a distinct bus icon for live vehicle markers
const createBusIcon = (color: string) => {
  return L.divIcon({
    className: 'bus-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 18px;
        border-radius: 4px;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transform: rotate(0deg);
      ">
        <!-- simple bus SVG -->
        <svg width="16" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="5" width="20" height="10" rx="2" fill="white" opacity="0.9" />
          <circle cx="7" cy="17" r="1.5" fill="white" />
          <circle cx="17" cy="17" r="1.5" fill="white" />
        </svg>
      </div>
    `,
    iconSize: [28, 18],
    iconAnchor: [14, 9],
    popupAnchor: [0, -9]
  })
}

// Component to handle map resize when panel size changes
function MapResizeHandler() {
  const map = useMap();
  
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 0);
    };

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Also check periodically for container size changes (for panel resizing)
    const interval = setInterval(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, [map]);

  return null;
}

// Create a pin icon for user-selected location
const createPinIcon = () => {
  return L.divIcon({
    className: 'pin-div-icon',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  })
}

// Inline stroller SVG for a clearer stroller icon (small and single-color)
function StrollerIcon({ size = 16, color = '#000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6h2l2 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="18" r="1.5" fill={color} />
      <circle cx="17" cy="18" r="1.5" fill={color} />
      <path d="M10 9h6a3 3 0 0 1 3 3v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
  const [lastActiveTab, setLastActiveTab] = useState<string>('search')
  const [hasLoadedRoutes, setHasLoadedRoutes] = useState<boolean>(false)
  const [busStopsData, setBusStopsData] = useState<CleanedBusStopsData | null>(null)

  // Clear map markers when switching tabs
  useEffect(() => {
    if (activeTab === 'search') {
      // Keep search tab data (busStopsData)
      // Clear closest tab data
      setPinnedLocation(null)
      setNearbyStops([])
      setNearbyStopsLiveData(new Map())
      setLoadingStopIds(new Set())
    } else if (activeTab === 'closest') {
      // Keep closest tab data
      // Clear search tab data
      setBusStopsData(null)
      setSelectedRoute('')
    } else if (activeTab === 'stopid') {
      // Clear both when going to stop id tab
      setBusStopsData(null)
      setSelectedRoute('')
      setPinnedLocation(null)
      setNearbyStops([])
      setNearbyStopsLiveData(new Map())
      setLoadingStopIds(new Set())
    }
  }, [activeTab])
  const [isLoadingStops, setIsLoadingStops] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [liveBusData, setLiveBusData] = useState<CleanedBusData | null>(null)
  const [isLoadingLiveBus, setIsLoadingLiveBus] = useState(false)
  const [testStopId, setTestStopId] = useState<string>('502185')
  const [selectedDirection, setSelectedDirection] = useState<'0' | '1'>('0')
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | null>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [selectedStop, setSelectedStop] = useState<{
    id: string
    name: string
    latitude: number
    longitude: number
  } | null>(null)
  // compact mode is default and fixed
  const compactMode = true

  // State for "Closest" tab - nearby stops functionality
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [nearbyStops, setNearbyStops] = useState<NearbyStop[]>([])
  const [isLoadingNearby, setIsLoadingNearby] = useState(false)
  const [searchRadius, setSearchRadius] = useState<number>(500) // in meters
  const [nearbyStopsLiveData, setNearbyStopsLiveData] = useState<Map<string, CleanedBusData>>(new Map())
  const [loadingStopIds, setLoadingStopIds] = useState<Set<string>>(new Set())
  const [filteredRoutes, setFilteredRoutes] = useState<Set<string>>(new Set())

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

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
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

  // Small helper component to grab map instance from context
  function MapSetter() {
    const m = useMap()
    useEffect(() => {
      setMap(m)
    }, [m])
    return null
  }

  // Component to handle map clicks for pinning locations (only active in "Closest" tab)
  function MapClickHandler() {
    useMapEvents({
      click: async (e) => {
        if (activeTab === 'closest') {
          const { lat, lng } = e.latlng
          setPinnedLocation({ lat, lon: lng })
          
          // Fetch nearby stops
          setIsLoadingNearby(true)
          setNearbyStops([])
          setNearbyStopsLiveData(new Map())
          try {
            const stops = await fetchStopsForLocation(lat, lng, searchRadius, 20)
            setNearbyStops(stops)
            console.log('Nearby stops:', stops)
            
            // Fetch live data for all stops
            if (stops.length > 0) {
              fetchLiveDataForNearbyStops(stops)
            }
          } catch (error) {
            console.error('Error fetching nearby stops:', error)
          } finally {
            setIsLoadingNearby(false)
          }
        }
      }
    })
    return null
  }

  // Fetch live data for all nearby stops
  const fetchLiveDataForNearbyStops = async (stops: NearbyStop[]) => {
    const newLiveData = new Map<string, CleanedBusData>()
    const loading = new Set<string>()
    
    for (const stop of stops) {
      loading.add(stop.id)
      setLoadingStopIds(new Set(loading))
      
      try {
        const data = await fetchMTABusData(stop.id)
        if (data && data.MonitoredStopVisit.length > 0) {
          newLiveData.set(stop.id, data)
          setNearbyStopsLiveData(new Map(newLiveData))
        }
      } catch (error) {
        console.error(`Error fetching live data for stop ${stop.id}:`, error)
      } finally {
        loading.delete(stop.id)
        setLoadingStopIds(new Set(loading))
      }
    }
  }

  // Clear pinned location and nearby stops
  const clearPinnedLocation = () => {
    setPinnedLocation(null)
    setNearbyStops([])
    setNearbyStopsLiveData(new Map())
    setLoadingStopIds(new Set())
  }

  // using lucide-react icons (Wheelchair for stroller, Eye for tracked)

  // Select a stop: center map and fetch live arrivals for that stop
  const handleSelectStop = async (stop: { id: string; name: string; latitude: number; longitude: number }) => {
    // Save the current tab before switching to stop view
    setLastActiveTab(activeTab)
    setSelectedStop(stop)
    setFilteredRoutes(new Set()) // Reset filters when selecting a new stop
    // center map on the selected stop
    if (map) {
      try {
        map.setView([stop.latitude, stop.longitude], 16)
      } catch (e) {
        // ignore
      }
    }

    setIsLoadingLiveBus(true)
    setLiveBusData(null)
    try {
      const data = await fetchMTABusData(stop.id)
      setLiveBusData(data)
    } catch (err) {
      console.error('Error fetching live bus data for stop', err)
    } finally {
      setIsLoadingLiveBus(false)
    }
  }

  // Refresh live data for currently selected stop
  const refreshLiveData = async () => {
    if (!selectedStop) return
    setIsLoadingLiveBus(true)
    try {
      const data = await fetchMTABusData(selectedStop.id)
      setLiveBusData(data)
    } catch (err) {
      console.error('Error refreshing live bus data for stop', err)
    } finally {
      setIsLoadingLiveBus(false)
    }
  }

  const toggleRouteFilter = (routeId: string) => {
    setFilteredRoutes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
      } else {
        newSet.add(routeId);
      }
      return newSet;
    });
  }

  // Auto-refresh every 30 seconds while viewing a stop
  useEffect(() => {
    if (!selectedStop) return
    const id = setInterval(() => {
      refreshLiveData()
    }, 30000)
    return () => clearInterval(id)
  }, [selectedStop])

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
    <div className="w-full" style={{ height: 'calc(100vh - 73px)' }}>
      <ResizablePanelGroup direction={isMobile ? "vertical" : "horizontal"} className="h-full">
        {/* Map Panel */}
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="w-full h-full relative z-0">
            <MapContainer
              center={defaultCenter}
              zoom={12}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
            >
              <MapSetter />
              <MapClickHandler />
              <MapResizeHandler />
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
                    eventHandlers={{
                      click: () => handleSelectStop({ id: stop.id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude })
                    }}
                  >
                    <Popup>
                      <div>
                        <strong>Stop {index + 1}: {stop.name}</strong>
                        <br />
                        ID: {stop.id}
                        <br />
                        Direction: {stop.direction}
                      </div>
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
                {/* Live vehicle markers (if live data present and for this stop) */}
                {liveBusData && liveBusData.MonitoredStopVisit.length > 0 && liveBusData.MonitoredStopVisit.map((mvj, idx) => {
                  // use color based on route/destination
                  // filter by filtered routes if set
                  if (filteredRoutes.size > 0 && !filteredRoutes.has(mvj.PublishedLineName)) return null;
                  const vColor = getBusRouteColor(mvj.DestinationName || mvj.PublishedLineName || '');
                  // ensure coords
                  if (!mvj.Latitude || !mvj.Longitude) return null;
                  return (
                    <Marker
                      key={`live-${idx}-${mvj.VehicleRef}`}
                      position={[mvj.Latitude, mvj.Longitude]}
                      icon={createBusIcon(vColor)}
                    >
                      <Popup>
                        <div>
                          <strong>{mvj.PublishedLineName} → {mvj.DestinationName}</strong>
                          <br />
                          Vehicle: #{mvj.VehicleNumber ?? mvj.VehicleRef}
                          <br />
                          Status: {mvj.Monitored ? 'Tracked' : 'Not Tracked'}
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </>
            );
          })()}

          {/* Pinned location marker and nearby stops (for "Closest" tab) */}
          {pinnedLocation && (
            <>
              {/* Pin marker */}
              <Marker 
                position={[pinnedLocation.lat, pinnedLocation.lon]}
                icon={createPinIcon()}
              >
                <Popup>
                  <div>
                    <strong>Pinned Location</strong>
                    <br />
                    Lat: {pinnedLocation.lat.toFixed(6)}
                    <br />
                    Lon: {pinnedLocation.lon.toFixed(6)}
                  </div>
                </Popup>
              </Marker>

              {/* Nearby stop markers */}
              {nearbyStops.map((stop) => (
                <Marker 
                  key={stop.id} 
                  position={[stop.lat, stop.lon]}
                  icon={createCustomIcon('#3b82f6')}
                  eventHandlers={{
                    click: () => handleSelectStop({ 
                      id: stop.id, 
                      name: stop.name, 
                      latitude: stop.lat, 
                      longitude: stop.lon 
                    })
                  }}
                >
                  <Popup>
                    <div>
                      <strong>{stop.name}</strong>
                      <br />
                      ID: {stop.id}
                      <br />
                      Code: {stop.code}
                      <br />
                      Routes: {stop.routes.map(r => r.shortName).join(', ')}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </>
          )}
        </MapContainer>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Content Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full p-4 lg:p-8 bg-background overflow-y-auto relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Bus Time</h1>
                <p className="text-sm text-muted-foreground">Live arrivals & vehicle locations</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs bg-muted rounded-full px-2 py-1 text-foreground/80">Auto-refresh: 30s</div>
              </div>
            </div>

        {/* If a stop is selected show the viewing panel only; otherwise show Tabs/search UI */}
        {!selectedStop ? (
          <Tabs defaultValue="search" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="closest">Closest</TabsTrigger>
            <TabsTrigger value="stopid">Stop ID</TabsTrigger>
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
                  <h2 className="text-sm font-semibold mb-3">
                    Route: {busStopsData.route}
                  </h2>
                  <h3 className="text-sm font-medium mb-2">
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
                      <li key={stop.id} className="text-sm p-2 hover:bg-accent rounded cursor-pointer" onClick={() => handleSelectStop({ id: stop.id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude })}>
                        {index + 1}. {stop.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="closest" className="mt-4">
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Find Nearby Stops
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click anywhere on the map to pin a location and find the closest bus stops.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search Radius</label>
                    <Select 
                      value={searchRadius.toString()} 
                      onValueChange={(value) => setSearchRadius(parseInt(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="250">0.15 miles (250m)</SelectItem>
                        <SelectItem value="500">0.3 miles (500m)</SelectItem>
                        <SelectItem value="750">0.5 miles (750m)</SelectItem>
                        <SelectItem value="1000">0.6 miles (1km)</SelectItem>
                        <SelectItem value="1500">0.9 miles (1.5km)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {pinnedLocation && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div className="text-sm">
                        <div className="font-medium">Pinned Location</div>
                        <div className="text-muted-foreground">
                          {pinnedLocation.lat.toFixed(6)}, {pinnedLocation.lon.toFixed(6)}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={clearPinnedLocation}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {isLoadingNearby && (
                <div className="text-center p-4">
                  <div className="text-sm text-muted-foreground">Searching for nearby stops...</div>
                </div>
              )}

              {!isLoadingNearby && nearbyStops.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">
                    Found {nearbyStops.length} stops nearby
                  </h4>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {nearbyStops.map((stop) => {
                      const liveData = nearbyStopsLiveData.get(stop.id)
                      const isLoading = loadingStopIds.has(stop.id)
                      
                      return (
                        <div 
                          key={stop.id}
                          className="border rounded-lg overflow-hidden"
                        >
                          {/* Stop Header */}
                          <div 
                            className="p-3 bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handleSelectStop({ 
                              id: stop.id, 
                              name: stop.name, 
                              latitude: stop.lat, 
                              longitude: stop.lon 
                            })}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{stop.name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Stop ID: {stop.id} {stop.code && `• Code: ${stop.code}`}
                                </div>
                              </div>
                              {stop.distance !== undefined && (
                                <div className="text-xs font-medium bg-background px-2 py-1 rounded ml-2 whitespace-nowrap">
                                  {stop.distance < 0.1 
                                    ? `${Math.round(stop.distance * 5280)} ft`
                                    : `${stop.distance.toFixed(2)} mi`
                                  }
                                </div>
                              )}
                            </div>
                            {stop.routes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {stop.routes.map((route, idx) => (
                                  <span 
                                    key={idx}
                                    className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs font-medium"
                                  >
                                    {route.shortName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Live Arrivals */}
                          <div className="p-3 bg-card">
                            {isLoading && (
                              <div className="text-xs text-muted-foreground">
                                Loading arrivals...
                              </div>
                            )}
                            
                            {!isLoading && liveData && liveData.MonitoredStopVisit.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                  Next arrivals:
                                </div>
                                {liveData.MonitoredStopVisit.slice(0, 3).map((bus, idx) => {
                                  let minutesAway = '';
                                  if (bus.ExpectedArrivalTimeISO) {
                                    try {
                                      const expected = new Date(bus.ExpectedArrivalTimeISO);
                                      const diff = Math.max(0, Math.round((expected.getTime() - Date.now()) / 60000));
                                      minutesAway = diff === 0 ? 'Due' : `${diff} min`;
                                    } catch (e) {
                                      minutesAway = bus.PresentableDistance;
                                    }
                                  } else {
                                    minutesAway = bus.PresentableDistance;
                                  }

                                  const color = getBusRouteColor(bus.DestinationName || bus.PublishedLineName || '');
                                  const hex = color.replace('#','');
                                  const r = parseInt(hex.substring(0,2),16);
                                  const g = parseInt(hex.substring(2,4),16);
                                  const b = parseInt(hex.substring(4,6),16);
                                  const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
                                  const textColor = luminance > 0.6 ? '#000' : '#fff';

                                  return (
                                    <div 
                                      key={idx} 
                                      className="flex items-center justify-between p-2 rounded text-xs"
                                      style={{ backgroundColor: color, color: textColor }}
                                    >
                                      <div>
                                        <div className="font-medium">
                                          {bus.PublishedLineName} → {bus.DestinationName}
                                        </div>
                                        <div className="opacity-75 text-[10px]">
                                          {bus.StopsFromCall} stops away
                                        </div>
                                      </div>
                                      <div className="font-bold text-sm">
                                        {minutesAway}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            
                            {!isLoading && (!liveData || liveData.MonitoredStopVisit.length === 0) && (
                              <div className="text-xs text-muted-foreground">
                                No upcoming buses
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!isLoadingNearby && pinnedLocation && nearbyStops.length === 0 && (
                <div className="text-center p-4 text-sm text-muted-foreground">
                  No bus stops found within {searchRadius}m of the pinned location.
                  Try increasing the search radius.
                </div>
              )}

              {!pinnedLocation && !isLoadingNearby && (
                <div className="text-center p-8 text-sm text-muted-foreground">
                  👆 Click on the map to start
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="stopid" className="mt-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Stop ID</label>
                <input
                  type="text"
                  value={testStopId}
                  onChange={(e) => setTestStopId(e.target.value)}
                  placeholder="Enter stop ID (e.g., MTA_502185)"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && testStopId) {
                      handleTestLiveBus()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tip: Stop IDs can be found on bus stop signs or from the other search methods
                </p>
              </div>
              
              <Button 
                onClick={handleTestLiveBus}
                disabled={isLoadingLiveBus || !testStopId}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoadingLiveBus ? 'Loading...' : 'Search'}
              </Button>
            </div>

            {liveBusData && (
              <div className="mt-4">
                {/* Stop Information */}
                <h3 className="font-semibold text-sm mb-2">Stop Information</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Stop ID:</span>
                    <span className="font-medium">{testStopId}</span>
                  </div>
                  {liveBusData.MonitoredStopVisit.length > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Routes:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
                          {Array.from(new Set(liveBusData.MonitoredStopVisit.map(m => m.PublishedLineName))).sort().map((route, idx) => {
                            // Find a bus with this route to get destination info for color
                            const busWithRoute = liveBusData.MonitoredStopVisit.find(m => m.PublishedLineName === route);
                            const color = getBusRouteColor(busWithRoute?.DestinationName || route);
                            const hex = color.replace('#','');
                            const r = parseInt(hex.substring(0,2),16);
                            const g = parseInt(hex.substring(2,4),16);
                            const b = parseInt(hex.substring(4,6),16);
                            const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
                            const textColor = luminance > 0.6 ? '#000' : '#fff';
                            
                            return (
                              <span 
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: color, color: textColor }}
                              >
                                {route}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Buses:</span>
                        <span className="font-medium">{liveBusData.MonitoredStopVisit.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Updated:</span>
                        <span className="font-medium">
                          {new Date(liveBusData.DataReceivedTimeISO || liveBusData.DataReceivedTime || '').toLocaleTimeString() || '—'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Bus Arrivals List */}
                {liveBusData.MonitoredStopVisit.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Upcoming Arrivals</h3>
                    {liveBusData.MonitoredStopVisit.map((bus, index) => {
                        // compute minutes and expected time
                        let minutesAway = '';
                        let expectedTimeOnly = '';
                        if (bus.ExpectedArrivalTimeISO) {
                          try {
                            const expected = new Date(bus.ExpectedArrivalTimeISO);
                            const diff = Math.max(0, Math.round((expected.getTime() - Date.now()) / 60000));
                            minutesAway = diff === 0 ? 'Due' : `${diff} min`;
                            const hh = String(expected.getHours()).padStart(2, '0');
                            const mm = String(expected.getMinutes()).padStart(2, '0');
                            const ss = String(expected.getSeconds()).padStart(2, '0');
                            expectedTimeOnly = `${hh}:${mm}:${ss}`;
                          } catch (e) {
                            minutesAway = bus.PresentableDistance;
                          }
                        } else {
                          minutesAway = bus.PresentableDistance;
                          const maybe = (bus.ExpectedArrivalTime || '').split(' ');
                          expectedTimeOnly = maybe.length > 1 ? maybe[1] : (maybe[0] || '');
                        }

                        const color = getBusRouteColor(bus.DestinationName || bus.PublishedLineName || '');
                        const hex = color.replace('#','');
                        const r = parseInt(hex.substring(0,2),16);
                        const g = parseInt(hex.substring(2,4),16);
                        const b = parseInt(hex.substring(4,6),16);
                        const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
                        const textColor = luminance > 0.6 ? '#000' : '#fff';
                        const status = bus.Monitored ? 'Tracked' : 'Not Tracked';
                        const showCapacity = (bus.EstimatedPassengerCount || bus.EstimatedPassengerCapacity) && (bus.EstimatedPassengerCount > 0 || bus.EstimatedPassengerCapacity > 0);

                        return (
                          <div key={index} className="mb-1 rounded overflow-hidden" style={{ background: color }}>
                            <div className="p-2" style={{ color: textColor }}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-sm">Bus {bus.PublishedLineName} → {bus.DestinationName}</div>
                                  <div className="text-[11px] opacity-90">Vehicle #{bus.VehicleNumber ?? bus.VehicleRef}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span title={status}><Eye size={14} color={textColor} /></span>
                                    {bus.StrollerVehicle && <span title="Stroller accessible"><StrollerIcon size={14} color={textColor} /></span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-semibold">{minutesAway}</div>
                                  <div className="text-[11px] opacity-90">{bus.StopsFromCall} stops</div>
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-1 text-[11px] opacity-90">
                                <div>Expected: <span className="font-medium">{expectedTimeOnly}</span></div>
                                <div>{showCapacity ? (<span>Capacity: <span className="font-medium">{bus.EstimatedPassengerCount} / {bus.EstimatedPassengerCapacity}</span></span>) : null}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )}

            {liveBusData && liveBusData.MonitoredStopVisit.length === 0 && (
              <div className="mt-6 text-sm text-center text-muted-foreground">
                No buses currently serving this stop
              </div>
            )}
          </TabsContent>
          </Tabs>
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Viewing</div>
                    <h3 className="text-lg font-semibold">{selectedStop.name}</h3>
                    <div className="text-sm text-muted-foreground mb-3">Stop ID: {selectedStop.id}</div>
                    {liveBusData && liveBusData.MonitoredStopVisit.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Filter by Route {filteredRoutes.size > 0 && `(${filteredRoutes.size} selected)`}
                        </p>
                        <div className="flex flex-wrap gap-2 items-center">
                          {Array.from(new Set(liveBusData.MonitoredStopVisit.map(m => m.PublishedLineName))).sort().map((route) => {
                            const isActive = filteredRoutes.size === 0 || filteredRoutes.has(route);
                            // Get color from a matching vehicle's destination
                            const matching = liveBusData.MonitoredStopVisit.find(m => m.PublishedLineName === route)
                            const colorSource = matching ? (matching.DestinationName || matching.PublishedLineName) : route
                            const color = getBusRouteColor(String(colorSource || ''))
                            // Compute readable text color
                            const hex = color.replace('#','')
                            const rr = parseInt(hex.substring(0,2),16)
                            const gg = parseInt(hex.substring(2,4),16)
                            const bb = parseInt(hex.substring(4,6),16)
                            const luminance = (0.299*rr + 0.587*gg + 0.114*bb)/255
                            const textColor = luminance > 0.6 ? '#000' : '#fff'
                            return (
                              <button
                                key={route}
                                onClick={() => toggleRouteFilter(route)}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition-all cursor-pointer hover:scale-105 ${
                                  isActive ? 'ring-2 ring-offset-2 ring-offset-background' : 'opacity-40 hover:opacity-60'
                                }`}
                                style={{ 
                                  backgroundColor: color,
                                  color: textColor,
                                  borderColor: color
                                }}
                                title={`Route ${route} - Click to ${isActive && filteredRoutes.size > 0 ? 'hide' : 'show'}`}
                              >
                                {route}
                              </button>
                            );
                          })}
                          {filteredRoutes.size > 0 && (
                            <button
                              onClick={() => setFilteredRoutes(new Set())}
                              className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-muted-foreground/30 rounded hover:border-foreground/50 transition-colors"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {liveBusData && (
                      <div className="text-xs text-muted-foreground mt-1">Last updated: {liveBusData.DataReceivedTime || liveBusData.DataReceivedTimeISO || '—'}</div>
                    )}
              </div>
              <div className="mt-3 sticky top-20 z-20 bg-background/0 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full" onClick={() => { setSelectedStop(null); setLiveBusData(null); setActiveTab(lastActiveTab); }}>
                    ← Back
                  </Button>
                  <Button variant="outline" className="w-full flex items-center justify-center gap-2" onClick={refreshLiveData} disabled={isLoadingLiveBus}>
                    {isLoadingLiveBus ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>{isLoadingLiveBus ? 'Refreshing...' : 'Refresh'}</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-1">
              {isLoadingLiveBus ? (
                <div className="text-sm p-2">Loading arrivals...</div>
                ) : liveBusData ? (
                liveBusData.MonitoredStopVisit.length > 0 ? (
                  <div>
                    {liveBusData.MonitoredStopVisit
                      .filter(bus => {
                        if (filteredRoutes.size === 0) return true
                        return filteredRoutes.has(bus.PublishedLineName)
                      })
                      .map((bus, i) => {
                      // compute minutes away and expected time-only (HH:MM:SS)
                      let minutesAway = '';
                      let expectedTimeOnly = '';
                      if (bus.ExpectedArrivalTimeISO) {
                        try {
                          const expected = new Date(bus.ExpectedArrivalTimeISO);
                          const diff = Math.max(0, Math.round((expected.getTime() - Date.now()) / 60000));
                          minutesAway = diff === 0 ? 'Due' : `${diff} min`;
                          const hh = String(expected.getHours()).padStart(2, '0');
                          const mm = String(expected.getMinutes()).padStart(2, '0');
                          const ss = String(expected.getSeconds()).padStart(2, '0');
                          expectedTimeOnly = `${hh}:${mm}:${ss}`;
                        } catch (e) {
                          minutesAway = bus.PresentableDistance;
                        }
                      } else {
                        minutesAway = bus.PresentableDistance;
                        const maybe = (bus.ExpectedArrivalTime || '').split(' ');
                        expectedTimeOnly = maybe.length > 1 ? maybe[1] : (maybe[0] || '');
                      }

                      // color based on route/destination
                      const color = getBusRouteColor(bus.DestinationName || bus.PublishedLineName || '');

                      // determine text color for contrast
                      const hex = color.replace('#','');
                      const r = parseInt(hex.substring(0,2),16);
                      const g = parseInt(hex.substring(2,4),16);
                      const b = parseInt(hex.substring(4,6),16);
                      const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
                      const textColor = luminance > 0.6 ? '#000' : '#fff';

                      const status = bus.Monitored ? 'Tracked' : 'Not Tracked';

                      const compactPadding = compactMode ? 'p-2' : 'p-3';
                      const titleClass = compactMode ? 'font-medium text-sm' : 'font-medium text-base';
                      const vehicleClass = compactMode ? 'text-[11px] opacity-90' : 'text-xs opacity-90';
                      const minutesClass = compactMode ? 'text-lg font-semibold' : 'text-xl font-bold';
                      const showCapacity = (bus.EstimatedPassengerCount || bus.EstimatedPassengerCapacity) && (bus.EstimatedPassengerCount > 0 || bus.EstimatedPassengerCapacity > 0);

                      return (
                        <div key={i} className="mb-1 rounded overflow-hidden" style={{ background: color }}>
                          <div className={`${compactPadding}`} style={{ color: textColor }}>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className={titleClass}>{bus.PublishedLineName} → {bus.DestinationName}</div>
                                <div className={vehicleClass}>Vehicle #{bus.VehicleNumber ?? bus.VehicleRef}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  {bus.StrollerVehicle && (
                                    <span title="Stroller accessible" style={{ color: textColor }}>
                                      <StrollerIcon size={compactMode ? 14 : 16} color={textColor} />
                                    </span>
                                  )}
                                  <span title={status}>
                                    <Eye size={compactMode ? 14 : 16} color={textColor} />
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={minutesClass}>{minutesAway}</div>
                                <div className="text-[11px] opacity-90">{bus.StopsFromCall} stops</div>
                              </div>
                            </div>
                            <div className={`flex justify-between items-center mt-1 text-[11px] opacity-90`}>
                              <div>Expected: <span className="font-medium">{expectedTimeOnly}</span></div>
                              <div>{showCapacity ? (<span>Capacity: <span className="font-medium">{bus.EstimatedPassengerCount} / {bus.EstimatedPassengerCapacity}</span></span>) : null}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-2">No upcoming buses</div>
                )
              ) : (
                <div className="text-sm text-muted-foreground p-2">No live data. Use the list or the map to select a stop.</div>
              )}
            </div>
          </div>
        )}

          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
