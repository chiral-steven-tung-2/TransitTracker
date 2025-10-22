
function cleanMTABusData(siriData) {

    ResponseTimestampRoute = siriData.Siri.ServiceDelivery.ResponseTimestamp
    responseTime = formatDateTime(ResponseTimestampRoute)
    newMonitoredStopVisit = []
    if (siriData && siriData.Siri && siriData.Siri.ServiceDelivery &&
        siriData.Siri.ServiceDelivery.StopMonitoringDelivery &&
        siriData.Siri.ServiceDelivery.StopMonitoringDelivery[0] &&
        siriData.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit) {

        for (let i = 0; i < siriData.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit.length; i++) {
            newMonitoredStopVisit.push(formatMonitoredVehicleJourney(siriData.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit[i].MonitoredVehicleJourney))
        }
    }
    
    stopData = {
        DataReceivedTime: responseTime,
        MonitoredStopVisit: newMonitoredStopVisit
        
    };
    
    return stopData
}

function formatMonitoredVehicleJourney(monitoredVehicle) {
    MonitoredVehicleJourney = {
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
        AimedArrivalTime: formatDateTime(monitoredVehicle.MonitoredCall.AimedArrivalTime),
        ExpectedArrivalTime: formatDateTime(monitoredVehicle.MonitoredCall.ExpectedArrivalTime),
        AimedDepartureTime: formatDateTime(monitoredVehicle.MonitoredCall.AimedDepartureTime),
        ExpectedDepartureTime: formatDateTime(monitoredVehicle.MonitoredCall.ExpectedDepartureTime),
        PresentableDistance: monitoredVehicle.MonitoredCall.Extensions.Distances.PresentableDistance,
        DistanceFromCall: monitoredVehicle.MonitoredCall.Extensions.Distances.DistanceFromCall,
        StopsFromCall: monitoredVehicle.MonitoredCall.Extensions.Distances.StopsFromCall,
        CallDistanceAlongRoute: monitoredVehicle.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute,
        EstimatedPassengerCount: getEstimatedPassengerCount(monitoredVehicle),
        EstimatedPassengerCapacity: getEstimatedPassengerCapacity(monitoredVehicle),
        StrollerVehicle: monitoredVehicle.MonitoredCall.Extensions.VehicleFeatures.StrollerVehicle,
    }

    return MonitoredVehicleJourney
}

function getEstimatedPassengerCount(monitoredVehicle) {
    if(monitoredVehicle.MonitoredCall.Extensions.Capacities && monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCount)
        return monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCount
    return 0
}

function getEstimatedPassengerCapacity(monitoredVehicle) {
    if(monitoredVehicle.MonitoredCall.Extensions.Capacities && monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCapacity !== undefined)
        return monitoredVehicle.MonitoredCall.Extensions.Capacities.EstimatedPassengerCapacity
    return 0
}

function getVehicleNumber(monitoredVehicle) {
    const match = monitoredVehicle.VehicleRef.match(/_(\d+)$/);
    return match ? match[1] : null;
}


function formatDateTime(dateTimeString) {
    // Parse the date string into a Date object
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

    return formattedDate + " " + formattedTime
}

module.exports = cleanMTABusData