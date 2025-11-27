import { XMLParser } from 'fast-xml-parser';

export interface RouteData {
	id: string;
	shortName: string;
	longName: string;
	description: string;
}

export interface CleanedRoutesData {
	manhattanReg: RouteData[];
	queensReg: RouteData[];
	bronxReg: RouteData[];
	brooklynReg: RouteData[];
	statenislandReg: RouteData[];
	xExp: RouteData[];
	queensExp: RouteData[];
	bronxExp: RouteData[];
	brooklynExp: RouteData[];
	statenislandExp: RouteData[];
	shuttles: RouteData[];
}

const parseXML = (xml: string): any => {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_'
	});
	return parser.parse(xml);
};

const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const cleanMTARoutesData = (rawData: any): CleanedRoutesData => {
	const routesList = rawData.response.data.list.route;

	const routesData: CleanedRoutesData = {
		manhattanReg: [], //route shortName starts with M
		queensReg: [], //route shortName starts with Q
		bronxReg: [], //route shortName starts with Bx
		brooklynReg: [], //route shortName starts with B
		statenislandReg: [], //route shortName starts with S
		xExp: [], //route shortName starts with X
		queensExp: [], //route shortName starts with QM
		bronxExp: [], //route shortName starts with BxM
		brooklynExp: [], //route shortName starts with BM
		statenislandExp: [], //route shortName starts with SIM
		shuttles: [] //others
	};

	for (let i = 0; i < routesList.length; i++) {
		const specificRoute: RouteData = {
			id: routesList[i].id,
			shortName: routesList[i].shortName,
			longName: routesList[i].longName,
			description: routesList[i].description
		};

		if (specificRoute.shortName.startsWith('QM')) {
			routesData.queensExp.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('BxM')) {
			routesData.bronxExp.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('BM')) {
			routesData.brooklynExp.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('SIM')) {
			routesData.statenislandExp.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('M')) {
			routesData.manhattanReg.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('Q')) {
			routesData.queensReg.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('Bx')) {
			routesData.bronxReg.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('B')) {
			routesData.brooklynReg.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('S')) {
			routesData.statenislandReg.push(specificRoute);
		} else if (specificRoute.shortName.startsWith('X')) {
			routesData.xExp.push(specificRoute);
		} else {
			routesData.shuttles.push(specificRoute);
		}
	}

	// Sort each list by shortName using natural order
	Object.keys(routesData).forEach((key) => {
		(routesData[key as keyof CleanedRoutesData] as RouteData[]).sort((a, b) => naturalCompare(a.shortName, b.shortName));
	});

	return routesData;
};

export const fetchNYCTBusRoutesData = async (): Promise<CleanedRoutesData> => {
	try {
		const url = `/api/mta/api/where/routes-for-agency/MTA%20NYCT.xml?key=${import.meta.env.VITE_MTA_API_KEY}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
		}
		const xml = await response.text();
		const parsed = parseXML(xml);
		const cleaned = cleanMTARoutesData(parsed);
		console.log('NYCT Response:', cleaned);
		return cleaned;
	} catch (error) {
		console.error('Fetching NYCT bus routes data failed', error);
		throw error;
	}
};

export const fetchBCBusRoutesData = async (): Promise<CleanedRoutesData> => {
	try {
		const url = `/api/mta/api/where/routes-for-agency/MTABC.xml?key=${import.meta.env.VITE_MTA_API_KEY}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
		}
		const xml = await response.text();
		const parsed = parseXML(xml);
		const cleaned = cleanMTARoutesData(parsed);
		console.log('BC Response:', cleaned);
		return cleaned;
	} catch (error) {
		console.error('Fetching BC bus routes data failed', error);
		throw error;
	}
};
