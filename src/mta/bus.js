
const cleanMTABusData = require('./helpers/bus-data-cleaner');

let busData = null;
let currentStopId = 502185;

const fetchBusData = async (stopId) => {
  try {
    const URL = `https://bustime.mta.info/api/siri/stop-monitoring.json?key=b1af2818-ea0d-4b2f-b632-5119632b6ae3&OperatorRef=MTA&MonitoringRef=${encodeURIComponent(stopId)}`
    const response = await fetch(URL);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    // Check if the data contains an error for a different stop ID
    if (data && data.Siri && data.Siri.ServiceDelivery && data.Siri.ServiceDelivery.StopMonitoringDelivery) {
      busData = data;
    } else {
      console.error('Received invalid data format from MTA API');
    }
  } catch (error) {
    console.error('Fetching data failed', error);
  }
};

exports.setStopId = async (stopId) => {
  currentStopId = stopId;
  await fetchBusData(stopId); // Fetch data immediately when stopId changes
};

exports.getBusData = (req, res) => {
  if (busData) {
    const cleanedData = cleanMTABusData(busData);
    res.json(cleanedData);
  } else {
    res.status(503).send('Data not available');
  }
};
