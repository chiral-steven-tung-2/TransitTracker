import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Train, ArrowLeft, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import {
  RAILROADS,
  getAllRoutes,
  getStopsForRouteService,
  getStopByIdService,
  type Railroad,
  type RailroadRouteInfo,
  type RailroadStopInfo
} from '../../services/mta-railroad-service';
import {
  fetchRailroadArrivalsMultiRoute,
  type RailroadRealtimeData
} from '../../services/mta-railroad-realtime';

interface Alert {
  id: string;
  alert: {
    informed_entity: Array<{
      route_id?: string;
    }>;
    active_period: Array<{
      start?: number;
      end?: number;
    }>;
    effect?: string;
    header_text?: {
      translation: Array<{
        text: string;
      }>;
    };
    description_text?: {
      translation: Array<{
        text: string;
      }>;
    };
    url?: {
      translation: Array<{
        text: string;
      }>;
    };
  };
}

interface ServiceStatusData {
  entity: Alert[];
}

export default function RailRoadPage() {
  const [activeTab, setActiveTab] = useState('search');
  const [selectedRailroad, setSelectedRailroad] = useState<Railroad | ''>('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<RailroadRouteInfo | null>(null);
  const [routes, setRoutes] = useState<RailroadRouteInfo[]>([]);
  const [stops, setStops] = useState<RailroadStopInfo[]>([]);
  const [selectedStop, setSelectedStop] = useState<RailroadStopInfo | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingStops, setLoadingStops] = useState(false);
  const [routeCache, setRouteCache] = useState<Map<string, RailroadRouteInfo>>(new Map());
  const [stopIdInput, setStopIdInput] = useState('');
  const [stopIdError, setStopIdError] = useState('');
  const [loadingStopId, setLoadingStopId] = useState(false);
  const [realtimeData, setRealtimeData] = useState<RailroadRealtimeData | null>(null);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [filteredRoutes, setFilteredRoutes] = useState<Set<string>>(new Set());
  const [showDepartedTrains, setShowDepartedTrains] = useState(false);
  const [serviceAlerts, setServiceAlerts] = useState<ServiceStatusData | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Load routes when railroad is selected
  useEffect(() => {
    if (selectedRailroad) {
      setLoadingRoutes(true);
      setSelectedRouteId('');
      setSelectedRoute(null);
      setStops([]);
      
      getAllRoutes(selectedRailroad)
        .then(routesData => {
          setRoutes(routesData);
          // Build route cache
          const cache = new Map<string, RailroadRouteInfo>();
          routesData.forEach(route => {
            cache.set(route.id, route);
          });
          setRouteCache(cache);
        })
        .catch(err => console.error('Error loading routes:', err))
        .finally(() => setLoadingRoutes(false));
    } else {
      setRoutes([]);
      setSelectedRouteId('');
      setSelectedRoute(null);
      setStops([]);
    }
  }, [selectedRailroad]);

  // Fetch service alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      if (!selectedRailroad) {
        setServiceAlerts(null);
        return;
      }

      setLoadingAlerts(true);
      try {
        const endpoint = selectedRailroad === 'lirr' 
          ? 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Flirr-alerts.json'
          : 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fmnr-alerts.json';
        
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to fetch alerts');
        const data = await response.json();
        setServiceAlerts(data);
      } catch (error) {
        console.error('Error fetching service alerts:', error);
        setServiceAlerts(null);
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
    // Refresh every 2 minutes
    const interval = setInterval(fetchAlerts, 120000);
    return () => clearInterval(interval);
  }, [selectedRailroad]);

  const isAlertActive = (alert: Alert): boolean => {
    const now = Math.floor(Date.now() / 1000);
    if (!alert.alert.active_period || alert.alert.active_period.length === 0) return true;
    return alert.alert.active_period.some(period => {
      if (period.start && period.end) return now >= period.start && now <= period.end;
      if (period.start && !period.end) return now >= period.start;
      if (!period.start && period.end) return now <= period.end;
      return true;
    });
  };

  const getActivePeriod = (alert: Alert) => {
    const now = Math.floor(Date.now() / 1000);
    if (!alert.alert.active_period || alert.alert.active_period.length === 0) return null;
    const activePeriod = alert.alert.active_period.find(period => {
      if (period.start && period.end) return now >= period.start && now <= period.end;
      if (period.start && !period.end) return now >= period.start;
      if (!period.start && period.end) return now <= period.end;
      return true;
    });
    return activePeriod || alert.alert.active_period[0];
  };

  const getAlertsForRoute = (routeId: string): Alert[] => {
    if (!serviceAlerts || !serviceAlerts.entity) return [];
    return serviceAlerts.entity.filter(alert => 
      alert.alert.informed_entity.some(entity => entity.route_id === routeId) &&
      isAlertActive(alert)
    );
  };

  const getAlertSeverityIcon = (effect?: string) => {
    switch (effect) {
      case 'SIGNIFICANT_DELAYS':
      case 'REDUCED_SERVICE':
        return <AlertCircle className="text-yellow-500" size={18} />;
      case 'NO_SERVICE':
      case 'SUSPENDED_SERVICE':
        return <XCircle className="text-red-500" size={18} />;
      case 'DETOUR':
      case 'MODIFIED_SERVICE':
        return <Clock className="text-orange-500" size={18} />;
      default:
        return <AlertCircle className="text-blue-500" size={18} />;
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Ongoing';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  // Load stops when route is selected
  const handleRouteChange = async (routeId: string) => {
    setSelectedRouteId(routeId);
    const route = routes.find(r => r.id === routeId);
    setSelectedRoute(route || null);
    
    if (!selectedRailroad) return;
    
    setLoadingStops(true);
    try {
      const stopsData = await getStopsForRouteService(selectedRailroad, routeId);
      setStops(stopsData);
    } catch (error) {
      console.error('Error loading stops:', error);
      setStops([]);
    } finally {
      setLoadingStops(false);
    }
  };

  const handleSelectStop = (stop: RailroadStopInfo) => {
    setSelectedStop(stop);
    setFilteredRoutes(new Set()); // Reset filters when selecting a new stop
    fetchRealtimeData(stop);
  };

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
  };

  const fetchRealtimeData = async (stop: RailroadStopInfo) => {
    if (!selectedRailroad) return;

    setLoadingRealtime(true);
    try {
      console.log(`Fetching arrivals for stop ${stop.id} (${stop.name}) on ${selectedRailroad.toUpperCase()}`);
      console.log(`Routes at this stop: ${stop.routes.join(', ')}`);

      // Fetch arrivals for all routes at this stop
      const data = await fetchRailroadArrivalsMultiRoute(selectedRailroad, stop.id, stop.routes);

      console.log(`Received ${data.arrivals.length} total arrivals`);
      
      // Debug: Log first few arrivals with times
      const now = Math.floor(Date.now() / 1000);
      console.log(`Current time (Unix): ${now}`);
      console.log(`Current time (Date): ${new Date(now * 1000).toLocaleString()}`);
      data.arrivals.slice(0, 3).forEach((arrival, i) => {
        const minutesAway = Math.floor((arrival.arrivalTime - now) / 60);
        console.log(`Arrival ${i + 1}:`, {
          destination: arrival.destination,
          arrivalTime: arrival.arrivalTime,
          arrivalDate: new Date(arrival.arrivalTime * 1000).toLocaleString(),
          minutesAway: minutesAway
        });
      });
      
      setRealtimeData(data);
    } catch (error) {
      console.error('Error fetching realtime data:', error);
      setRealtimeData(null);
    } finally {
      setLoadingRealtime(false);
    }
  };

  const handleBack = () => {
    setSelectedStop(null);
    setRealtimeData(null);
  };

  const handleStopIdSearch = async () => {
    if (!stopIdInput.trim()) {
      setStopIdError('Please enter a stop ID');
      return;
    }

    if (!selectedRailroad) {
      setStopIdError('Please select a railroad first');
      return;
    }

    setLoadingStopId(true);
    setStopIdError('');

    try {
      const stop = await getStopByIdService(selectedRailroad, stopIdInput.trim());
      
      if (!stop) {
        setStopIdError(`Stop ID "${stopIdInput}" not found on ${selectedRailroad.toUpperCase()}`);
        setLoadingStopId(false);
        return;
      }

      setSelectedStop(stop);
      setFilteredRoutes(new Set()); // Reset filters when selecting a new stop
      fetchRealtimeData(stop); // Fetch arrival data
    } catch (error) {
      console.error('Error fetching stop by ID:', error);
      setStopIdError('Error loading stop information. Please try again.');
    } finally {
      setLoadingStopId(false);
    }
  };

  // Clear selections when switching tabs
  useEffect(() => {
    setSelectedStop(null);
    setSelectedRouteId('');
    setStops([]);
  }, [activeTab]);

  return (
    <div className="h-full w-full bg-gradient-to-br from-background via-background to-muted/20 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Train className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Commuter Rail</h1>
              <p className="text-muted-foreground">LIRR & Metro-North schedules</p>
            </div>
          </div>
        </div>

        {/* Selected Stop View */}
        {selectedStop && (
          <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
            <Button
              variant="ghost"
              className="mb-4 -ml-2"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {activeTab === 'search' ? 'Routes' : 'Search'}
            </Button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {selectedStop.name}
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Stop ID: {selectedStop.id}
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Filter by Line {filteredRoutes.size > 0 && `(${filteredRoutes.size} selected)`}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {selectedStop.routes.map(routeId => {
                    const route = routeCache.get(routeId);
                    if (!route) return null;
                    const isActive = filteredRoutes.size === 0 || filteredRoutes.has(routeId);
                    return (
                      <button
                        key={routeId}
                        onClick={() => toggleRouteFilter(routeId)}
                        className={`w-10 h-10 rounded-full transition-all cursor-pointer hover:scale-110 flex items-center justify-center text-xs font-bold ${
                          isActive ? 'ring-2 ring-offset-2 ring-offset-background' : 'opacity-40 hover:opacity-60'
                        }`}
                        style={{
                          backgroundColor: route.color,
                          color: route.textColor
                        }}
                        title={`${route.longName} - Click to ${isActive && filteredRoutes.size > 0 ? 'hide' : 'show'}`}
                      >
                        {route.acronym}
                      </button>
                    );
                  })}
                  {filteredRoutes.size > 0 && (
                    <button
                      onClick={() => setFilteredRoutes(new Set())}
                      className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-muted-foreground/30 rounded-full hover:border-foreground/50 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                
                {/* Show/Hide Departed Trains Toggle */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setShowDepartedTrains(!showDepartedTrains)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      showDepartedTrains 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {showDepartedTrains ? '✓ Show departed trains' : 'Show departed trains'}
                  </button>
                </div>
              </div>
            </div>

            {/* Upcoming Arrivals */}
            {loadingRealtime && (
              <div className="bg-muted/50 rounded-lg p-8 text-center">
                <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
                <p className="text-base text-muted-foreground">
                  Loading arrivals...
                </p>
              </div>
            )}

            {!loadingRealtime && realtimeData && realtimeData.arrivals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Upcoming Trains</h3>
                <div className="space-y-6">
                  {(() => {
                    console.log('🎨 RENDERING ARRIVALS SECTION');
                    console.log(`📊 Total arrivals in realtimeData: ${realtimeData.arrivals.length}`);
                    console.log(`🔍 Filtered routes: ${Array.from(filteredRoutes).join(', ') || 'NONE (showing all)'}`);
                    
                    // Filter arrivals by selected routes
                    const filteredArrivals = filteredRoutes.size === 0 
                      ? realtimeData.arrivals 
                      : realtimeData.arrivals.filter(arrival => filteredRoutes.has(arrival.routeId));

                    console.log(`📊 Arrivals after route filter: ${filteredArrivals.length}`);

                    if (filteredArrivals.length === 0) {
                      return (
                        <div className="bg-muted/50 rounded-lg p-8 text-center">
                          <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p className="text-base text-muted-foreground">
                            No trains found for selected routes
                          </p>
                        </div>
                      );
                    }

                    // Group arrivals by destination
                    const arrivalsByDestination = filteredArrivals.reduce((acc, arrival) => {
                      const destination = arrival.destination || 'Unknown';
                      if (!acc[destination]) {
                        acc[destination] = [];
                      }
                      acc[destination].push(arrival);
                      return acc;
                    }, {} as Record<string, typeof realtimeData.arrivals>);

                    // Sort each group by arrival time and render
                    const renderedDestinations = Object.entries(arrivalsByDestination).map(([destination, arrivals]) => {
                      const now = Math.floor(Date.now() / 1000);
                      console.log(`\n🎯 Processing destination: ${destination}`);
                      console.log(`   Trains to this destination: ${arrivals.length}`);
                      
                      const sortedArrivals = arrivals
                        .filter(arrival => {
                          const minutesAway = Math.floor((arrival.arrivalTime - now) / 60);
                          // If showDepartedTrains is true, show all trains
                          // Otherwise, only show trains that haven't departed yet (or just departed within 1 min)
                          const keep = showDepartedTrains ? true : minutesAway >= -1;
                          if (!keep) {
                            console.log(`   ❌ Filtering out: ${minutesAway} mins (already departed)`);
                          } else {
                            console.log(`   ✅ Keeping: ${minutesAway} mins away`);
                          }
                          return keep;
                        })
                        .sort((a, b) => a.arrivalTime - b.arrivalTime)
                        .slice(0, 10); // Limit to 10 per destination

                      console.log(`   Final count for ${destination}: ${sortedArrivals.length} trains`);

                      if (sortedArrivals.length === 0) return null;

                      return (
                        <div key={destination} className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                            To {destination}
                          </div>
                          {sortedArrivals.map((arrival, index) => {
                            const minutesAway = Math.floor((arrival.arrivalTime - now) / 60);
                            const route = routeCache.get(arrival.routeId);
                            const hasDeparted = minutesAway < -1;

                            return (
                              <div 
                                key={`${arrival.tripId}-${index}`}
                                className={`rounded-md p-3 shadow-sm ${hasDeparted ? 'opacity-60' : ''}`}
                                style={{
                                  backgroundColor: route?.color || '#808183',
                                  color: route?.textColor || '#FFFFFF',
                                  border: 'none'
                                }}
                              >
                                <div className="flex justify-between items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="mb-1">
                                      <div className="text-sm font-bold opacity-95 truncate">
                                        {route?.longName || `Route ${arrival.routeId}`}
                                        {hasDeparted && <span className="ml-2 text-xs font-normal opacity-75">(Departed)</span>}
                                      </div>
                                    </div>
                                    <div className="text-xs opacity-75 flex gap-3">
                                      {arrival.track && (
                                        <span>Track {arrival.track}</span>
                                      )}
                                      <span>
                                        {new Date(arrival.arrivalTime * 1000).toLocaleTimeString([], { 
                                          hour: 'numeric', 
                                          minute: '2-digit' 
                                        })}
                                      </span>
                                      {arrival.status && (
                                        <span className="uppercase">{arrival.status}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-2xl font-bold">
                                      {hasDeparted ? 'Left' : minutesAway <= 0 ? 'Now' : minutesAway}
                                    </div>
                                    {!hasDeparted && minutesAway > 0 && (
                                      <div className="text-xs opacity-80">
                                        min{minutesAway !== 1 ? 's' : ''}
                                      </div>
                                    )}
                                    {hasDeparted && (
                                      <div className="text-xs opacity-80">
                                        {Math.abs(minutesAway)} min{Math.abs(minutesAway) !== 1 ? 's' : ''} ago
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }).filter(Boolean);

                    // If no destinations have upcoming trains, show message
                    if (renderedDestinations.length === 0) {
                      return (
                        <div className="bg-muted/50 rounded-lg p-8 text-center">
                          <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p className="text-base text-muted-foreground">
                            No upcoming trains found
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            All scheduled trains have already departed
                          </p>
                        </div>
                      );
                    }

                    return renderedDestinations;
                  })()}
                </div>
              </div>
            )}

            {!loadingRealtime && realtimeData && realtimeData.arrivals.length === 0 && (
              <div className="bg-muted/50 rounded-lg p-8 text-center">
                <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-base text-muted-foreground">
                  No upcoming trains found
                </p>
              </div>
            )}

            {!loadingRealtime && !realtimeData && (
              <div className="bg-muted/50 rounded-lg p-8 text-center">
                <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-base text-muted-foreground">
                  Unable to load arrival information
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {!selectedStop && (
          <Tabs defaultValue="search" className="w-full" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 h-12">
              <TabsTrigger value="search" className="text-base">Search by Line</TabsTrigger>
              <TabsTrigger value="stopid" className="text-base">Search by Stop ID</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-6">
              <div className="space-y-6">
                {/* Railroad Selection */}
                <div className="bg-card rounded-xl border shadow-sm p-6">
                  <label className="text-sm font-semibold mb-3 block text-foreground">Select Railroad</label>
                  <Select value={selectedRailroad} onValueChange={(value) => setSelectedRailroad(value as Railroad)}>
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder="Choose a railroad..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RAILROADS.map(railroad => (
                        <SelectItem key={railroad.id} value={railroad.id} className="text-base">
                          {railroad.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Route Selection */}
                {selectedRailroad && (
                  <div className="bg-card rounded-xl border shadow-sm p-6">
                    <label className="text-sm font-semibold mb-3 block text-foreground">Choose Branch/Line</label>
                    {loadingRoutes ? (
                      <div className="animate-pulse text-muted-foreground text-base py-3">
                        Loading lines...
                      </div>
                    ) : (
                      <Select 
                        value={selectedRouteId} 
                        onValueChange={handleRouteChange}
                        disabled={routes.length === 0}
                      >
                        <SelectTrigger className="w-full h-12 text-base">
                          <SelectValue placeholder="Select a line..." />
                        </SelectTrigger>
                        <SelectContent>
                          {routes.map(route => (
                            <SelectItem key={route.id} value={route.id} className="text-base py-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                                  style={{
                                    backgroundColor: route.color,
                                    color: route.textColor
                                  }}
                                >
                                  {route.acronym}
                                </span>
                                <span>{route.longName}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Stops List */}
                {loadingStops && (
                  <div className="bg-card rounded-xl border shadow-sm p-8 text-center">
                    <div className="animate-pulse text-muted-foreground text-base">Loading stations...</div>
                  </div>
                )}

                {selectedRoute && stops.length > 0 && (
                  <div className="bg-card rounded-xl border shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                      <span
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: selectedRoute.color,
                          color: selectedRoute.textColor
                        }}
                      >
                        {selectedRoute.acronym}
                      </span>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">
                          {selectedRoute.longName}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {stops.length} stations • Click a station for details
                        </p>
                      </div>
                    </div>

                    {/* Service Alerts for Selected Route */}
                    {(() => {
                      const alerts = getAlertsForRoute(selectedRoute.id);
                      if (alerts.length === 0) {
                        return (
                          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                            <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                            <span className="text-sm font-medium text-green-800 dark:text-green-200">Good Service</span>
                          </div>
                        );
                      }
                      return (
                        <div className="mb-4 space-y-3">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <AlertCircle size={16} />
                            Service Alerts ({alerts.length})
                          </h3>
                          {alerts.map((alert) => {
                            const headerText = alert.alert.header_text?.translation[0]?.text || 'Service Alert';
                            const descriptionText = alert.alert.description_text?.translation[0]?.text || '';
                            const activePeriod = getActivePeriod(alert);
                            const totalPeriods = alert.alert.active_period?.length || 0;
                            const periodIndex = activePeriod ? alert.alert.active_period?.indexOf(activePeriod) ?? -1 : -1;

                            return (
                              <div
                                key={alert.id}
                                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="mt-0.5">{getAlertSeverityIcon(alert.alert.effect)}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-foreground mb-1">{headerText}</div>
                                    {descriptionText && (
                                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{descriptionText}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      {totalPeriods > 1 && periodIndex >= 0 && (
                                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                          Period {periodIndex + 1} of {totalPeriods}
                                        </span>
                                      )}
                                      {activePeriod?.start && (
                                        <span><strong>Start:</strong> {formatDate(activePeriod.start)}</span>
                                      )}
                                      {activePeriod?.end && (
                                        <span><strong>End:</strong> {formatDate(activePeriod.end)}</span>
                                      )}
                                    </div>
                                    {alert.alert.url?.translation[0]?.text && (
                                      <a
                                        href={alert.alert.url.translation[0].text}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs mt-1 inline-block"
                                      >
                                        More Info →
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {stops.map((stop, index) => (
                        <div
                          key={stop.id} 
                          className="group p-4 hover:bg-accent rounded-lg cursor-pointer border border-transparent hover:border-primary/20 transition-all duration-200"
                          onClick={() => handleSelectStop(stop)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-muted-foreground w-8">
                                {(index + 1).toString().padStart(2, '0')}
                              </span>
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {stop.name}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {stop.routes.map(routeId => {
                                const r = routeCache.get(routeId);
                                if (!r) return null;
                                return (
                                  <span
                                    key={routeId}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold"
                                    style={{
                                      backgroundColor: r.color,
                                      color: r.textColor
                                    }}
                                    title={r.longName}
                                  >
                                    {r.acronym}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="stopid" className="mt-6">
              <div className="space-y-6">
                {/* Railroad Selection for Stop ID search */}
                <div className="bg-card rounded-xl border shadow-sm p-6">
                  <label className="text-sm font-semibold mb-3 block text-foreground">Select Railroad</label>
                  <Select value={selectedRailroad} onValueChange={(value) => setSelectedRailroad(value as Railroad)}>
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder="Choose a railroad..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RAILROADS.map(railroad => (
                        <SelectItem key={railroad.id} value={railroad.id} className="text-base">
                          {railroad.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stop ID Input */}
                <div className="bg-card rounded-xl border shadow-sm p-6">
                  <label className="text-sm font-semibold mb-3 block text-foreground">Enter Stop ID</label>
                  <div className="flex gap-3">
                    <Input
                      placeholder="e.g., 1, 237..."
                      className="flex-1 h-12 text-base"
                      value={stopIdInput}
                      onChange={(e) => setStopIdInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStopIdSearch()}
                      disabled={loadingStopId || !selectedRailroad}
                    />
                    <Button 
                      className="h-12 px-6"
                      onClick={handleStopIdSearch}
                      disabled={loadingStopId || !selectedRailroad}
                    >
                      <Train className="w-5 h-5 mr-2" />
                      {loadingStopId ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                  {stopIdError && (
                    <p className="text-sm text-destructive mt-3">
                      {stopIdError}
                    </p>
                  )}
                  {!stopIdError && (
                    <p className="text-xs text-muted-foreground mt-3">
                      {selectedRailroad ? 'Stop IDs can be found on station signs and timetables' : 'Please select a railroad first'}
                    </p>
                  )}
                </div>

                {!loadingStopId && (
                  <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
                    <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-base text-muted-foreground">
                      {selectedRailroad 
                        ? 'Enter a stop ID above to view station information'
                        : 'Select a railroad and enter a stop ID to get started'
                      }
                    </p>
                  </div>
                )}

                {loadingStopId && (
                  <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
                    <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
                    <p className="text-base text-muted-foreground">
                      Loading stop information...
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
