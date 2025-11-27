// TypeScript interfaces for MTA Bus API response
interface VehicleLocation {
  Longitude: number;
  Latitude: number;
}

interface Distances {
  PresentableDistance: string;
  DistanceFromCall: number;
  StopsFromCall: number;
  CallDistanceAlongRoute: number;
}

interface VehicleFeatures {
  StrollerVehicle: boolean;
}

interface Capacities {
  EstimatedPassengerCount?: number;
  EstimatedPassengerCapacity?: number;
}

interface Extensions {
  Distances: Distances;
  VehicleFeatures: VehicleFeatures;
  Capacities?: Capacities;
}

interface MonitoredCall {
  AimedArrivalTime: string;
  ExpectedArrivalTime: string;
  AimedDepartureTime: string;
  ExpectedDepartureTime: string;
  Extensions: Extensions;
}

interface MonitoredVehicleJourneyRaw {
  PublishedLineName: string;
  DestinationName: string;
  DirectionRef: string;
  VehicleLocation: VehicleLocation;
  Bearing: number;
  Monitored: boolean;
  ProgressRate: string;
  VehicleRef: string;
  MonitoredCall: MonitoredCall;
}

interface MonitoredStopVisitRaw {
  MonitoredVehicleJourney: MonitoredVehicleJourneyRaw;
}

interface StopMonitoringDelivery {
  ResponseTimestamp: string;
  MonitoredStopVisit?: MonitoredStopVisitRaw[];
}

interface ServiceDelivery {
  ResponseTimestamp: string;
  StopMonitoringDelivery: StopMonitoringDelivery[];
}

interface Siri {
  ServiceDelivery: ServiceDelivery;
}

interface MTABusResponse {
  Siri: Siri;
}

// Cleaned/formatted interfaces
export interface MonitoredVehicleJourney {
  PublishedLineName: string;
  DestinationName: string;
  DirectionRef: string;
  Longitude: number;
  Latitude: number;
  Bearing: number;
  Monitored: boolean;
  ProgressRate: string;
  VehicleRef: string;
  VehicleNumber: string | null;
  AimedArrivalTime: string;
  AimedArrivalTimeISO: string | null;
  ExpectedArrivalTime: string;
  ExpectedArrivalTimeISO: string | null;
  AimedDepartureTime: string;
  AimedDepartureTimeISO: string | null;
  ExpectedDepartureTime: string;
  ExpectedDepartureTimeISO: string | null;
  PresentableDistance: string;
  DistanceFromCall: number;
  StopsFromCall: number;
  CallDistanceAlongRoute: number;
  EstimatedPassengerCount: number;
  EstimatedPassengerCapacity: number;
  StrollerVehicle: boolean;
}

export interface CleanedBusData {
  DataReceivedTime: string;
  DataReceivedTimeISO: string | null;
  MonitoredStopVisit: MonitoredVehicleJourney[];
}

// Helper function to format date/time
function formatDateTime(dateTimeString: string): string {
  const date = new Date(dateTimeString);

  // Extract the date components
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  // Extract the time components
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Format the date and time
  const formattedDate = `${month}-${day}-${year}`;
  const formattedTime = `${hours}:${minutes}:${seconds}`;

  return `${formattedDate} ${formattedTime}`;
}

// Helper function to extract vehicle number
function getVehicleNumber(monitoredVehicle: MonitoredVehicleJourneyRaw): string | null {
  const match = monitoredVehicle.VehicleRef.match(/_(\d+)$/);
  return match ? match[1] : null;
}

// Helper function to get estimated passenger count
function getEstimatedPassengerCount(monitoredVehicle: MonitoredVehicleJourneyRaw): number {
  if (
    monitoredVehicle.MonitoredCall.Extensions.Capacities &&
    monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCount !== undefined
  ) {
    return monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCount;
  }
  return 0;
}

// Helper function to get estimated passenger capacity
function getEstimatedPassengerCapacity(monitoredVehicle: MonitoredVehicleJourneyRaw): number {
  if (
    monitoredVehicle.MonitoredCall.Extensions.Capacities &&
    monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCapacity !== undefined
  ) {
    return monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCapacity;
  }
  return 0;
}

// Format monitored vehicle journey
function formatMonitoredVehicleJourney(monitoredVehicle: MonitoredVehicleJourneyRaw): MonitoredVehicleJourney {
  const aimedArrivalRaw = monitoredVehicle.MonitoredCall.AimedArrivalTime || null;
  const expectedArrivalRaw = monitoredVehicle.MonitoredCall.ExpectedArrivalTime || null;
  const aimedDepartureRaw = monitoredVehicle.MonitoredCall.AimedDepartureTime || null;
  const expectedDepartureRaw = monitoredVehicle.MonitoredCall.ExpectedDepartureTime || null;

  return {
    PublishedLineName: monitoredVehicle.PublishedLineName,
    DestinationName: monitoredVehicle.DestinationName,
    DirectionRef: monitoredVehicle.DirectionRef,
    Longitude: monitoredVehicle.VehicleLocation.Longitude,
    Latitude: monitoredVehicle.VehicleLocation.Latitude,
    Bearing: monitoredVehicle.Bearing,
    Monitored: monitoredVehicle.Monitored,
    ProgressRate: monitoredVehicle.ProgressRate,
    VehicleRef: monitoredVehicle.VehicleRef,
    VehicleNumber: getVehicleNumber(monitoredVehicle),
    AimedArrivalTime: aimedArrivalRaw ? formatDateTime(aimedArrivalRaw) : '',
    AimedArrivalTimeISO: aimedArrivalRaw,
    ExpectedArrivalTime: expectedArrivalRaw ? formatDateTime(expectedArrivalRaw) : '',
    ExpectedArrivalTimeISO: expectedArrivalRaw,
    AimedDepartureTime: aimedDepartureRaw ? formatDateTime(aimedDepartureRaw) : '',
    AimedDepartureTimeISO: aimedDepartureRaw,
    ExpectedDepartureTime: expectedDepartureRaw ? formatDateTime(expectedDepartureRaw) : '',
    ExpectedDepartureTimeISO: expectedDepartureRaw,
    PresentableDistance: monitoredVehicle.MonitoredCall.Extensions.Distances.PresentableDistance,
    DistanceFromCall: monitoredVehicle.MonitoredCall.Extensions.Distances.DistanceFromCall,
    StopsFromCall: monitoredVehicle.MonitoredCall.Extensions.Distances.StopsFromCall,
    CallDistanceAlongRoute: monitoredVehicle.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute,
    EstimatedPassengerCount: getEstimatedPassengerCount(monitoredVehicle),
    EstimatedPassengerCapacity: getEstimatedPassengerCapacity(monitoredVehicle),
    StrollerVehicle: monitoredVehicle.MonitoredCall.Extensions.VehicleFeatures.StrollerVehicle,
  };
}

// Clean MTA bus data
export function cleanMTABusData(siriData: MTABusResponse): CleanedBusData {
  const responseTimestamp = siriData.Siri.ServiceDelivery.ResponseTimestamp;
  const responseTime = formatDateTime(responseTimestamp);
  const responseTimeISO = responseTimestamp || null;
  const newMonitoredStopVisit: MonitoredVehicleJourney[] = [];

  if (
    siriData &&
    siriData.Siri &&
    siriData.Siri.ServiceDelivery &&
    siriData.Siri.ServiceDelivery.StopMonitoringDelivery &&
    siriData.Siri.ServiceDelivery.StopMonitoringDelivery[0] &&
    siriData.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit
  ) {
    for (const visit of siriData.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit) {
      newMonitoredStopVisit.push(formatMonitoredVehicleJourney(visit.MonitoredVehicleJourney));
    }
  }

  return {
    DataReceivedTime: responseTime,
    DataReceivedTimeISO: responseTimeISO,
    MonitoredStopVisit: newMonitoredStopVisit,
  };
}

// Fetch bus data from MTA API
export async function fetchMTABusData(stopId: string | number): Promise<CleanedBusData | null> {
  try {
    // Use Vite proxy to avoid CORS issues
    const URL = `/api/mta/api/siri/stop-monitoring.json?key=${import.meta.env.VITE_MTA_API_KEY}&OperatorRef=MTA&MonitoringRef=${encodeURIComponent(stopId)}`;
    const response = await fetch(URL);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data: MTABusResponse = await response.json();
    
    // Check if the data contains valid stop monitoring delivery
    if (
      data &&
      data.Siri &&
      data.Siri.ServiceDelivery &&
      data.Siri.ServiceDelivery.StopMonitoringDelivery
    ) {
      return cleanMTABusData(data);
    } else {
      console.error('Received invalid data format from MTA API');
      return null;
    }
  } catch (error) {
    console.error('Fetching data failed', error);
    return null;
  }
}
