import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { getRoutesCache } from '@/services/gtfs-parser';
import { loadRailroadRoutes, type RailroadRoute } from '@/services/railroad-gtfs-parser';
import { fetchNYCTBusRoutesData, type RouteData } from '@/services/mta-bus-routes';

interface Alert {
  id: string;
  alert: {
    informed_entity: Array<{
      agency_id?: string;
      route_id?: string;
      trip_id?: string;
      stop_id?: string;
    }>;
    active_period: Array<{
      start?: number;
      end?: number;
    }>;
    cause?: string;
    effect?: string;
    url?: {
      translation: Array<{
        text: string;
        language?: string;
      }>;
    };
    header_text?: {
      translation: Array<{
        text: string;
        language?: string;
      }>;
    };
    description_text?: {
      translation: Array<{
        text: string;
        language?: string;
      }>;
    };
  };
}

interface ServiceStatusData {
  entity: Alert[];
}

interface RouteColorMap {
  [key: string]: { color: string; textColor: string; name?: string };
}

const API_ENDPOINTS = {
  subway: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json',
  bus: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fbus-alerts.json',
  lirr: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Flirr-alerts.json',
  mnrr: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fmnr-alerts.json',
};

const ServiceStatusPage = () => {
  const [subwayData, setSubwayData] = useState<ServiceStatusData | null>(null);
  const [busData, setBusData] = useState<ServiceStatusData | null>(null);
  const [lirrData, setLirrData] = useState<ServiceStatusData | null>(null);
  const [mnrrData, setMnrrData] = useState<ServiceStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subwayRouteColors, setSubwayRouteColors] = useState<RouteColorMap>({});
  const [lirrRoutes, setLirrRoutes] = useState<Map<string, RailroadRoute>>(new Map());
  const [mnrrRoutes, setMnrrRoutes] = useState<Map<string, RailroadRoute>>(new Map());
  const [busRoutesMap, setBusRoutesMap] = useState<Map<string, RouteData>>(new Map());

  // Load route color data
  useEffect(() => {
    const loadRouteData = async () => {
      try {
        // Load subway route colors
        const subwayRoutes = await getRoutesCache();
        const colorMap: RouteColorMap = {};
        subwayRoutes.forEach((route) => {
          colorMap[route.routeId] = {
            color: route.routeColor ? `#${route.routeColor}` : '#808183',
            textColor: route.routeTextColor ? `#${route.routeTextColor}` : '#000000',
          };
        });
        setSubwayRouteColors(colorMap);

        // Load bus routes
        const busRoutesData = await fetchNYCTBusRoutesData();
        const busMap = new Map<string, RouteData>();
        // Flatten all bus routes into a single map
        Object.values(busRoutesData).forEach((routeArray: RouteData[]) => {
          routeArray.forEach((route: RouteData) => {
            busMap.set(route.id, route);
            // Also add by shortName for alerts that use shortName as ID
            busMap.set(route.shortName, route);
          });
        });
        console.log('Bus Routes Map loaded:', busMap.size, 'routes');
        console.log('Sample route IDs:', Array.from(busMap.keys()).slice(0, 10));
        setBusRoutesMap(busMap);

        // Load railroad routes
        const lirrRoutesData = await loadRailroadRoutes('lirr');
        const mnrrRoutesData = await loadRailroadRoutes('mnrr');
        setLirrRoutes(lirrRoutesData);
        setMnrrRoutes(mnrrRoutesData);
      } catch (err) {
        console.error('Failed to load route data:', err);
      }
    };

    loadRouteData();
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [subwayResponse, busResponse, lirrResponse, mnrrResponse] = await Promise.all([
          fetch(API_ENDPOINTS.subway),
          fetch(API_ENDPOINTS.bus),
          fetch(API_ENDPOINTS.lirr),
          fetch(API_ENDPOINTS.mnrr),
        ]);

        if (!subwayResponse.ok || !busResponse.ok || !lirrResponse.ok || !mnrrResponse.ok) {
          throw new Error('Failed to fetch service status data');
        }

        const [subway, bus, lirr, mnrr] = await Promise.all([
          subwayResponse.json(),
          busResponse.json(),
          lirrResponse.json(),
          mnrrResponse.json(),
        ]);

        setSubwayData(subway);
        setBusData(bus);
        setLirrData(lirr);
        setMnrrData(mnrr);

        // Debug: Log raw data structure
        console.log('🔍 RAW DATA FETCHED:');
        console.log('Subway alerts:', subway?.entity?.length || 0);
        console.log('Bus alerts:', bus?.entity?.length || 0);
        console.log('LIRR alerts:', lirr?.entity?.length || 0);
        console.log('MNRR alerts:', mnrr?.entity?.length || 0);

        // Debug bus data specifically
        if (bus?.entity?.length > 0) {
          console.log('📋 BUS ALERTS DETAILS:');
          bus.entity.slice(0, 3).forEach((alert: Alert, index: number) => {
            console.log(`  Bus Alert ${index + 1}:`, {
              id: alert.id,
              header: alert.alert.header_text?.translation[0]?.text,
              periods: alert.alert.active_period?.length || 0,
              firstPeriod: alert.alert.active_period?.[0],
              informedEntities: alert.alert.informed_entity?.length || 0
            });
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
    // Refresh every 2 minutes
    const interval = setInterval(fetchAllData, 120000);
    return () => clearInterval(interval);
  }, []);

  const getAlertSeverityIcon = (effect?: string) => {
    switch (effect) {
      case 'SIGNIFICANT_DELAYS':
      case 'REDUCED_SERVICE':
        return <AlertCircle className="text-yellow-500" size={20} />;
      case 'NO_SERVICE':
      case 'SUSPENDED_SERVICE':
        return <XCircle className="text-red-500" size={20} />;
      case 'DETOUR':
      case 'MODIFIED_SERVICE':
        return <Clock className="text-orange-500" size={20} />;
      default:
        return <AlertCircle className="text-blue-500" size={20} />;
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Ongoing';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const getBusRouteColor = (routeId: string): { color: string; textColor: string } => {
    // Get the route data to check the route name patterns
    const route = busRoutesMap.get(routeId);
    
    if (route) {
      const shortName = route.shortName.toUpperCase();
      const longName = route.longName.toUpperCase();
      const description = route.description?.toUpperCase() || '';
      const combinedText = `${longName} ${description}`;
      
      // Priority order: Check shortName first for express routes, then check text for LIMITED/SBS
      // Express/Rush routes have specific shortName patterns
      if (shortName.startsWith('BXM') || shortName.startsWith('QM') || 
          shortName.startsWith('SIM') || shortName.startsWith('X')) {
        return { color: '#9333ea', textColor: '#FFFFFF' }; // Purple for Express
      } 
      // Limited routes have "LIMITED" in the name or + in shortName
      else if (combinedText.includes('LIMITED') || shortName.includes('+')) {
        return { color: '#dc2626', textColor: '#FFFFFF' }; // Red for Limited
      } 
      // Select Bus Service routes
      else if (combinedText.includes('SELECT BUS') || combinedText.includes('SBS')) {
        return { color: '#2563eb', textColor: '#FFFFFF' }; // Blue for Select Bus
      }
    }
    
    // Default: Green for local routes
    return { color: '#16a34a', textColor: '#FFFFFF' }; // Green
  };

  const getRouteDisplay = (routeId: string, type: 'subway' | 'bus' | 'lirr' | 'mnrr'): { 
    display: string; 
    color: string; 
    textColor: string; 
  } => {
    if (type === 'subway') {
      const colors = subwayRouteColors[routeId];
      return {
        display: routeId,
        color: colors?.color || '#808183',
        textColor: colors?.textColor || '#000000',
      };
    } else if (type === 'bus') {
      const colors = getBusRouteColor(routeId);
      return {
        display: routeId,
        ...colors,
      };
    } else if (type === 'lirr') {
      const route = lirrRoutes.get(routeId);
      return {
        display: route?.routeLongName || routeId,
        color: route?.routeColor || '#808183',
        textColor: route?.routeTextColor || '#FFFFFF',
      };
    } else if (type === 'mnrr') {
      const route = mnrrRoutes.get(routeId);
      return {
        display: route?.routeLongName || routeId,
        color: route?.routeColor || '#808183',
        textColor: route?.routeTextColor || '#FFFFFF',
      };
    }
    return { display: routeId, color: '#808183', textColor: '#000000' };
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

  // Get the currently active period to display on the card
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

  const renderAlerts = (data: ServiceStatusData | null, serviceType: 'subway' | 'bus' | 'lirr' | 'mnrr', typeName: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-lg">Loading {typeName} service status...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center p-8 text-red-500">
          <AlertCircle className="mr-2" />
          <div>Error loading service status: {error}</div>
        </div>
      );
    }

    // Console log the active alerts being shown
    const now = Math.floor(Date.now() / 1000);
    const activeAlerts = data?.entity?.filter(isAlertActive) || [];
    const rejectedAlerts = data?.entity?.filter(alert => !isAlertActive(alert)) || [];

    // Console log the active alerts being shown
    console.log(`\n[${typeName}] Current Time: ${new Date(now * 1000).toLocaleString()}`);
    console.log(`[${typeName}] Total alerts: ${data?.entity?.length || 0}`);
    console.log(`[${typeName}] Active alerts: ${activeAlerts.length}`);
    console.log(`[${typeName}] Filtered out: ${rejectedAlerts.length}\n`);
    
    // Show active alerts
    console.log(`✅ SHOWING (${activeAlerts.length} alerts):`);
    activeAlerts.forEach((alert, index) => {
      const headerText = alert.alert.header_text?.translation[0]?.text || 'Service Alert';
      const firstPeriod = alert.alert.active_period?.[0];
      
      if (firstPeriod) {
        const startDate = firstPeriod.start ? new Date(firstPeriod.start * 1000).toLocaleString() : 'No start';
        const endDate = firstPeriod.end ? new Date(firstPeriod.end * 1000).toLocaleString() : 'No end';
        console.log(`  ${index + 1}. "${headerText}"`);
        console.log(`     ${startDate} → ${endDate}`);
      } else {
        console.log(`  ${index + 1}. "${headerText}" (No time period)`);
      }
    });
    
    // Show rejected alerts (first 10)
    if (rejectedAlerts.length > 0) {
      console.log(`\n❌ FILTERED OUT (${rejectedAlerts.length} alerts, showing first 10):`);
      rejectedAlerts.slice(0, 10).forEach((alert, index) => {
        const headerText = alert.alert.header_text?.translation[0]?.text || 'Service Alert';
        const firstPeriod = alert.alert.active_period?.[0];
        
        if (firstPeriod) {
          const startDate = firstPeriod.start ? new Date(firstPeriod.start * 1000).toLocaleString() : 'No start';
          const endDate = firstPeriod.end ? new Date(firstPeriod.end * 1000).toLocaleString() : 'No end';
          console.log(`  ${index + 1}. "${headerText}"`);
          console.log(`     ${startDate} → ${endDate}`);
        } else {
          console.log(`  ${index + 1}. "${headerText}" (No time period)`);
        }
      });
    }

    if (!data || !data.entity || activeAlerts.length === 0) {
      return (
        <div className="flex items-center justify-center p-8 text-green-600">
          <CheckCircle className="mr-2" size={24} />
          <div className="text-lg font-semibold">Good Service - No Active Alerts</div>
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        {activeAlerts.map((alert) => {
          const headerText = alert.alert.header_text?.translation[0]?.text || 'Service Alert';
          const descriptionText = alert.alert.description_text?.translation[0]?.text || '';
          const affectedRoutes = alert.alert.informed_entity
            .map((entity) => entity.route_id)
            .filter((id): id is string => !!id)
            .filter((id, index, self) => self.indexOf(id) === index);

          return (
            <div
              key={alert.id}
              className="border rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">{getAlertSeverityIcon(alert.alert.effect)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{headerText}</h3>
                    {alert.alert.effect && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 whitespace-nowrap">
                        {alert.alert.effect.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {affectedRoutes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {affectedRoutes.map((routeId) => {
                        const routeInfo = getRouteDisplay(routeId, serviceType);
                        return (
                          <span
                            key={routeId}
                            className="px-3 py-1 rounded-full text-sm font-semibold"
                            style={{
                              backgroundColor: routeInfo.color,
                              color: routeInfo.textColor,
                            }}
                          >
                            {routeInfo.display}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {descriptionText && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                      {descriptionText}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
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
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-2 inline-block"
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
    );
  };

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">MTA Service Status</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time service alerts and updates for all MTA services
          </p>
        </div>

        <Tabs defaultValue="subway" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="subway">Subway</TabsTrigger>
            <TabsTrigger value="bus">Bus</TabsTrigger>
            <TabsTrigger value="lirr">LIRR</TabsTrigger>
            <TabsTrigger value="mnrr">Metro-North</TabsTrigger>
          </TabsList>

          <TabsContent value="subway" className="border rounded-lg">
            {renderAlerts(subwayData, 'subway', 'Subway')}
          </TabsContent>

          <TabsContent value="bus" className="border rounded-lg">
            {renderAlerts(busData, 'bus', 'Bus')}
          </TabsContent>

          <TabsContent value="lirr" className="border rounded-lg">
            {renderAlerts(lirrData, 'lirr', 'LIRR')}
          </TabsContent>

          <TabsContent value="mnrr" className="border rounded-lg">
            {renderAlerts(mnrrData, 'mnrr', 'Metro-North')}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ServiceStatusPage;
