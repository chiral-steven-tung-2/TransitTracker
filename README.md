# TransitTracker

A comprehensive real-time transit tracking application for New York Metro area, featuring subway, bus, commuter rail (LIRR & Metro-North), and Stony Brook University campus buses.

## Project Structure

### Root Configuration Files
- **`package.json`** - Project dependencies and scripts
- **`vite.config.ts`** - Vite build configuration
- **`tsconfig.json`** - TypeScript compiler configuration
- **`eslint.config.js`** - ESLint linting rules
- **`components.json`** - shadcn/ui component configuration
- **`index.html`** - Application entry point

### Source Directory (`src/`)

#### Main Application Files
- **`main.tsx`** - Application entry point, renders the root component
- **`App.tsx`** - Main application component with navigation and routing
- **`index.css`** - Tailwind CSS imports and theme styles

#### Components (`src/components/`)

##### Page Components (`src/components/pages/`)
- **`MetroPage.tsx`** - Subway tracking interface
  - Search by line (route groups: 123, ACE, BDFM, etc.)
  - Search by stop ID
  - Displays northbound/southbound arrivals
  - Route filtering functionality
  - Real-time arrival predictions with actual destinations

- **`RailRoadPage.tsx`** - LIRR and Metro-North commuter rail interface
  - Railroad selection (LIRR/MNRR)
  - Search by line or stop ID
  - Displays trains grouped by destination
  - Route filtering with acronyms (PJ, NH, LB, etc.)
  - Shows departed trains toggle
  - Real-time arrivals with track numbers and delays

- **`BusPage.tsx`** - MTA Bus tracking interface
  - Search by route (NYCT & Bronx/Brooklyn routes)
  - Search by stop ID
  - Closest stops finder (geolocation-based)
  - Resizable map panel (horizontal on desktop, vertical on mobile)
  - Live vehicle locations on map
  - Route geometry visualization
  - Auto-refresh every 30 seconds

- **`SbuBusPage.tsx`** - Stony Brook University campus bus interface
  - Search by route or stop
  - Next bus arrival times
  - Route geometry visualization
  - Resizable map panel

- **`MainLayout.tsx`** - Application layout wrapper with navigation

##### UI Components (`src/components/ui/`)
Pre-built shadcn/ui components for consistent design:
- **Form controls**: `button.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `switch.tsx`
- **Navigation**: `tabs.tsx`, `navigation-menu.tsx`, `breadcrumb.tsx`, `menubar.tsx`
- **Overlays**: `dialog.tsx`, `popover.tsx`, `tooltip.tsx`, `sheet.tsx`, `drawer.tsx`
- **Data display**: `table.tsx`, `card.tsx`, `badge.tsx`, `alert.tsx`, `accordion.tsx`
- **Feedback**: `progress.tsx`, `spinner.tsx`, `skeleton.tsx`
- **Layout**: `resizable.tsx`, `separator.tsx`, `scroll-area.tsx`

#### Services (`src/services/`)

##### Subway Services
- **`mta-subway-routes.ts`** - Loads subway routes from GTFS `routes.txt`
  - Groups routes by service (IRT, IND, BMT)
  - Provides route colors and display names

- **`mta-subway-stops.ts`** - Loads subway stops from GTFS `stops.txt`
  - Fetches stops for specific routes
  - Provides stop lookup by ID

- **`mta-subway-realtime.ts`** - Real-time subway arrivals
  - Fetches GTFS-Realtime protobuf feeds
  - Determines destinations from stop sequences
  - Separates northbound/southbound trains
  - Handles multiple feed endpoints (ACE, BDFM, NQRW, etc.)

##### Railroad Services
- **`mta-railroad-service.ts`** - High-level API for LIRR and Metro-North
  - Unified interface for both railroads
  - Route acronyms (PJ=Port Jefferson, NH=New Haven, etc.)
  - Stop and route queries

- **`railroad-gtfs-parser.ts`** - GTFS data parser for commuter rails
  - Parses `routes.txt`, `stops.txt`, `stop_times.txt`, `trips.txt`
  - CSV parsing with quoted field support
  - Caching mechanism for performance
  - Route-to-stops mapping

- **`mta-railroad-realtime.ts`** - Real-time railroad arrivals
  - GTFS-Realtime feed parsing
  - Destination inference from stop sequences
  - Track assignments and delay information
  - Supports both LIRR and Metro-North feeds

##### Bus Services
- **`mta-bus-routes.ts`** - Loads MTA bus routes
  - NYCT and Bronx/Brooklyn routes
  - Route metadata and colors

- **`mta-bus-stops.ts`** - Bus stop data and location services
  - Stop lookup by route
  - Nearby stops search using geolocation

- **`mta-live-bus.ts`** - Real-time MTA bus tracking
  - Fetches live vehicle positions
  - Arrival predictions at stops
  - Vehicle tracking data

- **`mta-route-geometry.ts`** - Bus route path visualization
  - Route polyline coordinates
  - Caching for performance

- **`sbu-bus-service.ts`** - Stony Brook University bus service
  - Campus bus routes and stops
  - Next bus predictions
  - Static GTFS data from CSV files

- **`route-geometry.ts`** - Generic route geometry service
  - OSRM routing API integration
  - Coordinate fetching and caching

##### GTFS Parser
- **`gtfs-parser.ts`** - Generic GTFS data parser
  - Loads `trips.txt`, `stops.txt` for subway system
  - CSV parsing utilities
  - Data caching

#### GTFS Static Data Directories

##### Subway Data (`public/mta-subway-data/`)
- `routes.txt` - Subway route definitions
- `stops.txt` - All subway station locations
- `trips.txt` - Trip definitions with headsigns

##### LIRR Data (`public/mta-lirr-data/`)
- `routes.txt` - LIRR branch definitions
- `stops.txt` - Station locations
- `stop_times.txt` - Scheduled stop times
- `trips.txt` - Trip definitions

##### Metro-North Data (`public/mta-mnrr-data/`)
- `routes.txt` - Metro-North line definitions
- `stops.txt` - Station locations
- `stop_times.txt` - Scheduled stop times
- `trips.txt` - Trip definitions

##### SBU Bus Data (`src/services/sbu-bus-data/`)
- CSV files for each campus route (Inner Loop, Outer Loop, Hospital, etc.)
- `Stops List.csv` - All campus stop locations

#### Utilities (`src/lib/`)
- **`utils.ts`** - Utility functions (className merging, etc.)

### Public Assets (`public/`)
- Static assets served directly

## Key Features

### Real-Time Data Integration
- **GTFS-Realtime feeds**: Uses Protocol Buffers to decode live transit data
- **Destination inference**: Analyzes stop sequences when headsign data is missing
- **Auto-refresh**: Periodic updates for live arrival information

### Route Filtering
- Filter arrivals by selected routes
- Visual indicators for active/inactive filters
- Persistent across data refreshes

### Responsive Design
- Desktop: Horizontal split-panel layout
- Mobile: Vertical split-panel (map on top, content below)
- Resizable panels for customizable workspace

### Map Integration
- Leaflet-based interactive maps
- Live vehicle tracking
- Route geometry visualization
- Stop markers with popups
- Auto-resize handling for panel changes

### Departed Trains Toggle
- Option to show/hide recently departed trains
- Visual indicators (reduced opacity, "Departed" label)
- Shows time since departure

## Technologies Used

- **React 19.1.1** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Leaflet** - Interactive maps
- **GTFS-Realtime** - Real-time transit data format
- **Protocol Buffers** - Binary data encoding

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Data Sources

- **MTA GTFS Static Data**: Routes, stops, and schedules
- **MTA GTFS-Realtime Feeds**: Live vehicle positions and predictions
- **OSRM Routing**: Route geometry generation
- **SBU Transportation**: Campus bus schedules and routes
