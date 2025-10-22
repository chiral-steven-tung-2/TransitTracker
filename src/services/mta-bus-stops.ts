export interface BusStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  direction: string;
  // Add more fields as needed
}

import { XMLParser } from 'fast-xml-parser';

const MTA_API_KEY = 'b1af2818-ea0d-4b2f-b632-5119632b6ae3';

const parseXML = (xml: string): any => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  return parser.parse(xml);
}

const fetchStopData = async (stopId: string): Promise<any> => {
  const url = `/api/mta/api/where/stop/${stopId}.xml?key=${MTA_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const xmlData = await response.text();
    const result = parseXML(xmlData);
    return result.response.data;
  } catch (error) {
    console.error('Error fetching or parsing XML data:', error);
    throw error;
  }
}

const getStopsData = async (idList: string[]): Promise<any[]> => {
  const stopData: any[] = [];
  for (let i = 0; i < idList.length; i++) {
    const stopId = idList[i];
    try {
      const stopInfo = await fetchStopData(stopId);
      if (stopInfo) {
        stopData.push({
          id: stopInfo.id,
          name: stopInfo.name,
          longitude: stopInfo.lon ? parseFloat(stopInfo.lon) : 0,
          latitude: stopInfo.lat ? parseFloat(stopInfo.lat) : 0,
          direction: stopInfo.direction || '',
          code: stopInfo.code,
          locationType: stopInfo.locationType
        });
      }
    } catch (error) {
      console.error(`Error fetching data for stop ID ${stopId}:`, error);
    }
  }
  return stopData;
};

export interface CleanedBusStopsData {
  route: string;
  zeroDirDest: string;
  zeroDirStopsData: Array<{
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    direction: string;
    code: string;
    locationType: string;
  }>;
  oneDirDest: string;
  oneDirStopsData: Array<{
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    direction: string;
    code: string;
    locationType: string;
  }>;
}

export const cleanMTAStopsData = async (stopsData: any): Promise<CleanedBusStopsData> => {
  const newStopsData: CleanedBusStopsData = {
    route: stopsData.data.entry.routeId,
    zeroDirDest: stopsData.data.entry.stopGroupings[0].stopGroups[0].name.name,
    zeroDirStopsData: [],
    oneDirDest: stopsData?.data?.entry?.stopGroupings[0]?.stopGroups[1]?.name?.name || "Refer Above (Bus is a Loop)",
    oneDirStopsData: []
  };

  // Fetch and populate stop data for zero direction stops
  const zeroDirStopsIds = stopsData.data.entry.stopGroupings[0].stopGroups[0].stopIds;
  newStopsData.zeroDirStopsData = await getStopsData(zeroDirStopsIds);
  // Fetch and populate stop data for one direction stops
  if (stopsData?.data?.entry?.stopGroupings[0]?.stopGroups[1]?.stopIds) {
    const oneDirStopsIds = stopsData.data.entry.stopGroupings[0].stopGroups[1].stopIds;
    newStopsData.oneDirStopsData = await getStopsData(oneDirStopsIds);
  }

  return newStopsData;
};
export const fetchBusStopsData = async (busRoute: string): Promise<CleanedBusStopsData> => {
  try {
    const url = `/api/mta/api/where/stops-for-route/${encodeURIComponent(busRoute)}.json?key=${MTA_API_KEY}&includePolylines=false&version=2`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const busStopData = await response.json();
    const cleaned = await cleanMTAStopsData(busStopData);
    return cleaned;
  } catch (error) {
    console.error('Fetching bus stop data failed', error);
    throw error;
  }
}
