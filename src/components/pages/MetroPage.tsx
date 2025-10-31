import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Train, ArrowLeft, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { 
  getSubwayRouteGroups,
  type SubwayRoute 
} from '../../services/mta-subway-routes';
import { 
  fetchSubwayStopsForRoute,
  fetchSubwayStopById,
  type SubwayStop 
} from '../../services/mta-subway-stops';
import {
  fetchSubwayArrivals,
  type SubwayRealtimeData
} from '../../services/mta-subway-realtime';

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

export default function MetroPage() {
  const [activeTab, setActiveTab] = useState('search');
  const [selectedRouteGroup, setSelectedRouteGroup] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<SubwayRoute | null>(null);
  const [stops, setStops] = useState<SubwayStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<SubwayStop | null>(null);
  const [loadingStops, setLoadingStops] = useState(false);
  const [realtimeData, setRealtimeData] = useState<SubwayRealtimeData | null>(null);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [routeGroups, setRouteGroups] = useState<{ name: string; routes: SubwayRoute[] }[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [routeCache, setRouteCache] = useState<Map<string, SubwayRoute>>(new Map());
  const [stopIdInput, setStopIdInput] = useState('');
  const [stopIdError, setStopIdError] = useState('');
  const [loadingStopId, setLoadingStopId] = useState(false);
  const [filteredRoutes, setFilteredRoutes] = useState<Set<string>>(new Set());
  const [serviceAlerts, setServiceAlerts] = useState<ServiceStatusData | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Load route groups on mount
  useEffect(() => {
    getSubwayRouteGroups()
      .then(groups => {
        setRouteGroups(groups);
        setLoadingRoutes(false);
        // Pre-populate route cache
        const cache = new Map<string, SubwayRoute>();
        groups.forEach(group => {
          group.routes.forEach(route => {
            console.log(`Caching route ${route.id}: color=${route.color}, textColor=${route.textColor}`);
            cache.set(route.id, route);
          });
        });
        console.log('Route cache populated with', cache.size, 'routes');
        setRouteCache(cache);
      })
      .catch(error => {
        console.error('Error loading routes:', error);
        setLoadingRoutes(false);
      });
  }, []);

  // Fetch service alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const response = await fetch('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json');
        if (response.ok) {
          const data = await response.json();
          setServiceAlerts(data);
        }
      } catch (error) {
        console.error('Error loading service alerts:', error);
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
    // Refresh every 2 minutes
    const interval = setInterval(fetchAlerts, 120000);
    return () => clearInterval(interval);
  }, []);

  const availableRoutes = selectedRouteGroup 
    ? routeGroups.find(g => g.name === selectedRouteGroup)?.routes || []
    : [];

  // Load stops when route is selected
  useEffect(() => {
    if (selectedRouteId) {
      setLoadingStops(true);
      fetchSubwayStopsForRoute(selectedRouteId)
        .then(stopsData => {
          setStops(stopsData);
          setLoadingStops(false);
        })
        .catch(error => {
          console.error('Error loading stops:', error);
          setLoadingStops(false);
        });
    } else {
      setStops([]);
    }
  }, [selectedRouteId]);

  const handleRouteChange = async (routeId: string) => {
    setSelectedRouteId(routeId);
    // Get route from cache instead of async call
    const route = routeCache.get(routeId);
    setSelectedRoute(route || null);
    setSelectedStop(null);
  };

  const handleSelectStop = (stop: SubwayStop) => {
    setSelectedStop(stop);
    setFilteredRoutes(new Set()); // Reset filters when selecting a new stop
    // Fetch realtime data for the stop
    fetchRealtimeData(stop);
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

  const isAlertActive = (alert: Alert): boolean => {
    const now = Math.floor(Date.now() / 1000); // Current time in Unix timestamp
    
    // If no active period is specified, consider the alert always active
    if (!alert.alert.active_period || alert.alert.active_period.length === 0) {
      return true;
    }

    // Check if ANY period is currently active
    return alert.alert.active_period.some(period => {
      // If both start and end exist, check if current time is within range
      if (period.start && period.end) {
        return now >= period.start && now <= period.end;
      }
      
      // If only start exists, check if it has started
      if (period.start && !period.end) {
        return now >= period.start;
      }
      
      // If only end exists, check if it hasn't ended
      if (!period.start && period.end) {
        return now <= period.end;
      }
      
      // If neither start nor end exist, consider it always active
      return true;
    });
  };

  const getActivePeriod = (alert: Alert) => {
    const now = Math.floor(Date.now() / 1000);
    
    if (!alert.alert.active_period || alert.alert.active_period.length === 0) {
      return null;
    }

    // Find the first period that is currently active
    const activePeriod = alert.alert.active_period.find(period => {
      if (period.start && period.end) {
        return now >= period.start && now <= period.end;
      }
      if (period.start && !period.end) {
        return now >= period.start;
      }
      if (!period.start && period.end) {
        return now <= period.end;
      }
      return true;
    });

    // If we found an active period, return it; otherwise return the first period
    return activePeriod || alert.alert.active_period[0];
  };

  const getAlertsForRoute = (routeId: string): Alert[] => {
    if (!serviceAlerts || !serviceAlerts.entity) return [];
    return serviceAlerts.entity.filter(alert => 
      alert.alert.informed_entity.some(entity => entity.route_id === routeId) &&
      isAlertActive(alert)
    );
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

  const fetchRealtimeData = async (stop: SubwayStop) => {
    // Fetch data for all routes that serve this stop
    setLoadingRealtime(true);
    try {
      // Get base stop ID (without N/S suffix)
      const baseStopId = stop.id.replace(/[NS]$/i, '');
      
      console.log(`Fetching arrivals for stop ${stop.id} (${stop.name})`);
      console.log(`Routes at this stop: ${stop.routes.join(', ')}`);
      console.log(`Base stop ID: ${baseStopId}`);
      
      // Fetch arrivals for all routes at this stop in parallel
      const allFetchPromises = stop.routes.map(routeId => 
        fetchSubwayArrivals(`${baseStopId}N`, routeId).catch(err => {
          console.log(`Failed to fetch for route ${routeId}: ${err.message}`);
          return { stopId: baseStopId, northbound: [], southbound: [], lastUpdated: Date.now() };
        })
      );
      
      const allResults = await Promise.all(allFetchPromises);
      
      // Combine all arrivals from all routes
      const combinedNorthbound = allResults.flatMap(result => result.northbound);
      const combinedSouthbound = allResults.flatMap(result => result.southbound);
      
      // Sort by arrival time
      combinedNorthbound.sort((a, b) => a.arrivalTime - b.arrivalTime);
      combinedSouthbound.sort((a, b) => a.arrivalTime - b.arrivalTime);
      
      console.log(`Combined: ${combinedNorthbound.length} northbound + ${combinedSouthbound.length} southbound arrivals`);
      
      setRealtimeData({
        stopId: baseStopId,
        northbound: combinedNorthbound,
        southbound: combinedSouthbound,
        lastUpdated: Date.now()
      });
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

    setLoadingStopId(true);
    setStopIdError('');

    try {
      // Fetch the stop by ID
      const stop = await fetchSubwayStopById(stopIdInput.trim());
      
      if (!stop) {
        setStopIdError(`Stop ID "${stopIdInput}" not found`);
        setLoadingStopId(false);
        return;
      }

      // Import getRoutesForStop to populate routes
      const { getRoutesForStop } = await import('../../services/gtfs-parser');
      const routes = await getRoutesForStop(stop.id);
      stop.routes = routes;

      // Select the stop and fetch realtime data
      setSelectedStop(stop);
      fetchRealtimeData(stop);
    } catch (error) {
      console.error('Error fetching stop by ID:', error);
      setStopIdError('Error loading stop information. Please try again.');
    } finally {
      setLoadingStopId(false);
    }
  };

  // Clear map when switching tabs
  useEffect(() => {
    setSelectedStop(null);
    setSelectedRouteId('');
    setSelectedRouteGroup('');
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
              <h1 className="text-3xl font-bold text-foreground">NYC Subway</h1>
              <p className="text-muted-foreground">Real-time arrivals & station information</p>
            </div>
          </div>
        </div>

        {/* Show loading state while routes are being loaded */}
        {loadingRoutes && (
          <div className="text-center p-12 bg-card rounded-xl border shadow-sm">
            <Train className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <div className="text-sm text-muted-foreground">Loading subway data...</div>
          </div>
        )}

        {/* If a stop is selected show the viewing panel; otherwise show tabs */}
        {!loadingRoutes && !selectedStop && (
          <Tabs defaultValue="search" className="w-full" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 h-12">
              <TabsTrigger value="search" className="text-base">Search by Line</TabsTrigger>
              <TabsTrigger value="stopid" className="text-base">Search by Stop ID</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-6">
              <div className="space-y-6">
                <div className="bg-card rounded-xl border shadow-sm p-6">
                  <label className="text-sm font-semibold mb-3 block text-foreground">Select Line Group</label>
                  <Select value={selectedRouteGroup} onValueChange={setSelectedRouteGroup}>
                    <SelectTrigger className="w-full h-12 text-base">
                      {selectedRouteGroup ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            {routeGroups.find(g => g.name === selectedRouteGroup)?.routes.map(route => (
                              <span
                                key={route.id}
                                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                                style={{
                                  backgroundColor: route.color,
                                  color: route.textColor
                                }}
                              >
                                {route.shortName}
                              </span>
                            ))}
                          </div>
                          <span className="text-muted-foreground">{selectedRouteGroup}</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Choose a line group..." />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {routeGroups.map(group => (
                        <SelectItem key={group.name} value={group.name} className="text-base py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              {group.routes.map(route => (
                                <span
                                  key={route.id}
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm"
                                  style={{
                                    backgroundColor: route.color,
                                    color: route.textColor
                                  }}
                                >
                                  {route.shortName}
                                </span>
                              ))}
                            </div>
                            <span className="text-muted-foreground">{group.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-card rounded-xl border shadow-sm p-6">
                  <label className="text-sm font-semibold mb-3 block text-foreground">Choose Subway Line</label>
                  <Select 
                    value={selectedRouteId} 
                    onValueChange={handleRouteChange}
                    disabled={!selectedRouteGroup || availableRoutes.length === 0}
                  >
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder={selectedRouteGroup ? "Select a line..." : "Select group first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoutes.map(route => (
                        <SelectItem key={route.id} value={route.id} className="text-base py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="px-3 py-1 rounded-full font-bold text-base"
                              style={{
                                backgroundColor: route.color,
                                color: route.textColor
                              }}
                            >
                              {route.shortName}
                            </span>
                            <span>{route.longName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingStops && (
                  <div className="bg-card rounded-xl border shadow-sm p-8 text-center">
                    <div className="animate-pulse text-muted-foreground text-base">Loading stations...</div>
                  </div>
                )}

                {selectedRoute && stops.length > 0 && (
                  <>
                    {/* Service Status Alerts */}
                    {(() => {
                      const alerts = getAlertsForRoute(selectedRoute.id);
                      if (alerts.length > 0) {
                        return (
                          <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                              <AlertCircle className="text-yellow-500" size={20} />
                              Service Alerts for this Line
                            </h3>
                            <div className="space-y-3">
                              {alerts.map(alert => {
                                const headerText = alert.alert.header_text?.translation[0]?.text || 'Service Alert';
                                const descriptionText = alert.alert.description_text?.translation[0]?.text || '';
                                return (
                                  <div
                                    key={alert.id}
                                    className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950/20 hover:shadow-md transition-shadow"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="mt-0.5">{getAlertSeverityIcon(alert.alert.effect)}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <h4 className="font-semibold text-sm">{headerText}</h4>
                                          {alert.alert.effect && (
                                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 whitespace-nowrap shrink-0">
                                              {alert.alert.effect.replace(/_/g, ' ')}
                                            </span>
                                          )}
                                        </div>
                                        {descriptionText && (
                                          <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
                                            {descriptionText}
                                          </p>
                                        )}
                                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                                          {(() => {
                                            const activePeriod = getActivePeriod(alert);
                                            if (!activePeriod) return null;
                                            
                                            const totalPeriods = alert.alert.active_period?.length || 0;
                                            const periodIndex = alert.alert.active_period?.indexOf(activePeriod) ?? -1;
                                            const showPeriodLabel = totalPeriods > 1 && periodIndex >= 0;
                                            
                                            return (
                                              <>
                                                {showPeriodLabel && (
                                                  <div className="w-full mb-1">
                                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                      Period {periodIndex + 1} of {totalPeriods}
                                                    </span>
                                                  </div>
                                                )}
                                                {activePeriod.start && (
                                                  <div>
                                                    <span className="font-semibold">Start:</span>{' '}
                                                    {formatDate(activePeriod.start)}
                                                  </div>
                                                )}
                                                {activePeriod.end && (
                                                  <div>
                                                    <span className="font-semibold">End:</span>{' '}
                                                    {formatDate(activePeriod.end)}
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                        {alert.alert.url?.translation[0]?.text && (
                                          <a
                                            href={alert.alert.url.translation[0].text}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 dark:text-blue-400 hover:underline text-xs mt-2 inline-block"
                                          >
                                            More Information →
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      } else if (!loadingAlerts) {
                        return (
                          <div className="bg-card rounded-xl border shadow-sm p-4 mb-6 flex items-center gap-2 text-green-600">
                            <CheckCircle size={18} />
                            <span className="text-sm font-semibold">Good Service - No Active Alerts</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="bg-card rounded-xl border shadow-sm p-6">
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                        <span
                          className="px-4 py-2 rounded-full font-bold text-xl"
                          style={{
                            backgroundColor: selectedRoute.color,
                            color: selectedRoute.textColor
                          }}
                        >
                          {selectedRoute.shortName}
                        </span>
                        <div>
                          <h2 className="text-xl font-bold text-foreground">
                            {selectedRoute.longName}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {stops.length} stations • Click a station to view arrivals
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">
                        {selectedRoute.description}
                      </div>
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
                                    className="px-2 py-0.5 rounded text-xs font-bold"
                                    style={{
                                      backgroundColor: r.color,
                                      color: r.textColor
                                    }}
                                  >
                                    {r.shortName}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="stopid" className="mt-6">
              <div className="space-y-6">
                <div className="bg-card rounded-xl border shadow-sm p-6">
                  <label className="text-sm font-semibold mb-3 block text-foreground">Enter Stop ID</label>
                  <div className="flex gap-3">
                    <Input
                      placeholder="e.g., 127N, D14S, 635..."
                      className="flex-1 h-12 text-base"
                      value={stopIdInput}
                      onChange={(e) => setStopIdInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStopIdSearch()}
                      disabled={loadingStopId}
                    />
                    <Button 
                      className="h-12 px-6"
                      onClick={handleStopIdSearch}
                      disabled={loadingStopId}
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
                      Stop IDs can be found on station signs and online maps
                    </p>
                  )}
                </div>
                {!loadingStopId && (
                  <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
                    <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-base text-muted-foreground">
                      Enter a stop ID above to view real-time arrival information
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
        
        {!loadingRoutes && selectedStop && (
          /* Viewing selected stop */
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mb-4" 
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="border rounded-lg p-4 mb-4">
              <div className="text-sm text-muted-foreground">Viewing</div>
              <h3 className="text-lg font-semibold">{selectedStop.name}</h3>
              <div className="text-sm text-muted-foreground mb-3">Stop ID: {selectedStop.id}</div>
              
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Filter by Line {filteredRoutes.size > 0 && `(${filteredRoutes.size} selected)`}
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  {selectedStop.routes.map(routeId => {
                    const route = routeCache.get(routeId);
                    if (!route) return null;
                    const isActive = filteredRoutes.size === 0 || filteredRoutes.has(routeId);
                    return (
                      <button
                        key={routeId}
                        onClick={() => toggleRouteFilter(routeId)}
                        className={`px-3 py-1.5 rounded font-bold text-sm transition-all cursor-pointer hover:scale-105 ${
                          isActive ? 'ring-2 ring-offset-2 ring-offset-background' : 'opacity-40 hover:opacity-60'
                        }`}
                        style={{ 
                          backgroundColor: route.color,
                          color: route.textColor
                        }}
                        title={`${route.shortName} - Click to ${isActive && filteredRoutes.size > 0 ? 'hide' : 'show'}`}
                      >
                        {route.shortName}
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
            </div>

            {/* Upcoming Arrivals */}
            {loadingRealtime && (
              <div className="text-sm text-muted-foreground text-center p-4">
                Loading arrivals...
              </div>
            )}

            {!loadingRealtime && realtimeData && (realtimeData.northbound.length > 0 || realtimeData.southbound.length > 0) && (
              <div className="space-y-6">
                {(() => {
                  // Filter arrivals by selected routes
                  const filterArrivals = (arrivals: typeof realtimeData.northbound) => 
                    filteredRoutes.size === 0 
                      ? arrivals 
                      : arrivals.filter(arrival => filteredRoutes.has(arrival.routeId));

                  const filteredNorthbound = filterArrivals(realtimeData.northbound);
                  const filteredSouthbound = filterArrivals(realtimeData.southbound);

                  if (filteredNorthbound.length === 0 && filteredSouthbound.length === 0) {
                    return (
                      <div className="bg-muted/50 rounded-lg p-8 text-center">
                        <Train className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-base text-muted-foreground">
                          No trains found for selected routes
                        </p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Northbound Trains */}
                      {filteredNorthbound.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-3">↑ Northbound</h3>
                          <div className="space-y-2">
                            {filteredNorthbound.slice(0, 10).map((arrival, index) => {
                        const now = Math.floor(Date.now() / 1000);
                        const minutesAway = Math.floor((arrival.arrivalTime - now) / 60);
                        const route = routeCache.get(arrival.routeId);
                        
                        if (minutesAway < 0) return null;

                        return (
                          <div 
                            key={`${arrival.tripId}-${index}`}
                            className="rounded-md p-2.5 shadow-sm"
                            style={{
                              backgroundColor: route?.color || '#808183',
                              color: route?.textColor || '#FFFFFF',
                              border: 'none'
                            }}
                          >
                            <div className="flex justify-between items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="px-2 py-0.5 rounded-full font-bold text-sm flex-shrink-0"
                                    style={{
                                      backgroundColor: route?.textColor || '#FFFFFF',
                                      color: route?.color || '#808183'
                                    }}
                                  >
                                    {route?.shortName || arrival.routeId}
                                  </span>
                                  <div className="min-w-0">
                                    {arrival.destination && (
                                      <div className="text-sm font-semibold opacity-95 truncate">
                                        → {arrival.destination}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-2xl font-bold">
                                  {minutesAway === 0 ? 'Now' : minutesAway}
                                </div>
                                {minutesAway > 0 && (
                                  <div className="text-xs opacity-80">
                                    min{minutesAway !== 1 ? 's' : ''}
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

                {/* Southbound Trains */}
                {filteredSouthbound.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">↓ Southbound</h3>
                    <div className="space-y-2">
                      {filteredSouthbound.slice(0, 10).map((arrival, index) => {
                        const now = Math.floor(Date.now() / 1000);
                        const minutesAway = Math.floor((arrival.arrivalTime - now) / 60);
                        const route = routeCache.get(arrival.routeId);
                        
                        if (minutesAway < 0) return null;

                        return (
                          <div 
                            key={`${arrival.tripId}-${index}`}
                            className="rounded-md p-2.5 shadow-sm"
                            style={{
                              backgroundColor: route?.color || '#808183',
                              color: route?.textColor || '#FFFFFF',
                              border: 'none'
                            }}
                          >
                            <div className="flex justify-between items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="px-2 py-0.5 rounded-full font-bold text-sm flex-shrink-0"
                                    style={{
                                      backgroundColor: route?.textColor || '#FFFFFF',
                                      color: route?.color || '#808183'
                                    }}
                                  >
                                    {route?.shortName || arrival.routeId}
                                  </span>
                                  <div className="min-w-0">
                                    {arrival.destination && (
                                      <div className="text-sm font-semibold opacity-95 truncate">
                                        → {arrival.destination}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-2xl font-bold">
                                  {minutesAway === 0 ? 'Now' : minutesAway}
                                </div>
                                {minutesAway > 0 && (
                                  <div className="text-xs opacity-80">
                                    min{minutesAway !== 1 ? 's' : ''}
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
              </>
            );
          })()}
        </div>
      )}

            {!loadingRealtime && realtimeData && realtimeData.northbound.length === 0 && realtimeData.southbound.length === 0 && (
              <div className="text-sm text-muted-foreground text-center p-4">
                No upcoming arrivals found
              </div>
            )}

            {!loadingRealtime && !realtimeData && (
              <div className="text-sm text-muted-foreground text-center p-4">
                Unable to load arrival information
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
