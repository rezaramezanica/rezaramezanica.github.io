import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { geoMercator } from "d3-geo";
import { Factory, MapPin } from "lucide-react";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Coordinates = [number, number];

type NodeKind = "factory_current" | "factory_planned" | "customer";

interface Node {
  id: string;
  name: string;
  coordinates: Coordinates;
  kind: NodeKind;
  details?: Record<string, string>;
}

interface Route {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  volume: "high" | "medium" | "low";
  label: string;
}

const factories: Node[] = [
  {
    id: "factory-israel",
    name: "Factory — Israel (Current)",
    coordinates: [35.2137, 31.7683],
    kind: "factory_current",
    details: {
      status: "Operating",
      note: "Current manufacturing site",
    },
  },
  {
    id: "factory-china",
    name: "Factory — China (Current)",
    coordinates: [120.5954, 31.2989], // Suzhou area
    kind: "factory_current",
    details: {
      status: "Operating",
      note: "Current manufacturing site",
    },
  },
  {
    id: "factory-singapore",
    name: "Factory — Singapore (Planned)",
    coordinates: [103.8198, 1.3521],
    kind: "factory_planned",
    details: {
      status: "Planned",
      note: "Future expansion site",
    },
  },
];

const customers: Node[] = [
  {
    id: "customer-taiwan",
    name: "Customers — Taiwan",
    coordinates: [121.0, 24.0],
    kind: "customer",
    details: { region: "Asia" },
  },
  {
    id: "customer-japan",
    name: "Customers — Japan",
    coordinates: [139.0, 36.0],
    kind: "customer",
    details: { region: "Asia" },
  },
  {
    id: "customer-korea",
    name: "Customers — South Korea",
    coordinates: [127.5, 37.0],
    kind: "customer",
    details: { region: "Asia" },
  },
  {
    id: "customer-malaysia",
    name: "Customers — Malaysia",
    coordinates: [101.98, 4.21],
    kind: "customer",
    details: { region: "Asia" },
  },
  {
    id: "customer-us",
    name: "Customers — United States",
    coordinates: [-98.0, 39.5],
    kind: "customer",
    details: { region: "North America" },
  },
  {
    id: "customer-eu",
    name: "Customers — Europe",
    coordinates: [10.0, 50.0],
    kind: "customer",
    details: { region: "Europe" },
  },
];

const nodes: Node[] = [...factories, ...customers];

const routes: Route[] = [
  // Israel → customers (all regions)
  { id: "r-il-tw", fromNodeId: "factory-israel", toNodeId: "customer-taiwan", volume: "medium", label: "Containers" },
  { id: "r-il-jp", fromNodeId: "factory-israel", toNodeId: "customer-japan", volume: "low", label: "Containers" },
  { id: "r-il-kr", fromNodeId: "factory-israel", toNodeId: "customer-korea", volume: "low", label: "Containers" },
  { id: "r-il-my", fromNodeId: "factory-israel", toNodeId: "customer-malaysia", volume: "low", label: "Containers" },
  { id: "r-il-us", fromNodeId: "factory-israel", toNodeId: "customer-us", volume: "low", label: "Containers" },
  { id: "r-il-eu", fromNodeId: "factory-israel", toNodeId: "customer-eu", volume: "low", label: "Containers" },

  // China → Asia customers only
  { id: "r-cn-tw", fromNodeId: "factory-china", toNodeId: "customer-taiwan", volume: "high", label: "Containers" },
  { id: "r-cn-jp", fromNodeId: "factory-china", toNodeId: "customer-japan", volume: "medium", label: "Containers" },
  { id: "r-cn-kr", fromNodeId: "factory-china", toNodeId: "customer-korea", volume: "high", label: "Containers" },
  { id: "r-cn-my", fromNodeId: "factory-china", toNodeId: "customer-malaysia", volume: "high", label: "Containers" },

  // Singapore (planned) → customers
  { id: "r-sg-tw", fromNodeId: "factory-singapore", toNodeId: "customer-taiwan", volume: "high", label: "Planned containers" },
  { id: "r-sg-jp", fromNodeId: "factory-singapore", toNodeId: "customer-japan", volume: "medium", label: "Planned containers" },
  { id: "r-sg-kr", fromNodeId: "factory-singapore", toNodeId: "customer-korea", volume: "high", label: "Planned containers" },
  { id: "r-sg-my", fromNodeId: "factory-singapore", toNodeId: "customer-malaysia", volume: "high", label: "Planned containers" },
  { id: "r-sg-us", fromNodeId: "factory-singapore", toNodeId: "customer-us", volume: "low", label: "Planned containers" },
  { id: "r-sg-eu", fromNodeId: "factory-singapore", toNodeId: "customer-eu", volume: "low", label: "Planned containers" },
];

function volumeToStyle(volume: Route["volume"]) {
  switch (volume) {
    case "high":
      return { strokeWidth: 2.2, opacity: 0.75 };
    case "medium":
      return { strokeWidth: 1.6, opacity: 0.55 };
    case "low":
      return { strokeWidth: 1.1, opacity: 0.4 };
    default:
      return { strokeWidth: 1.4, opacity: 0.5 };
  }
}

function arcPath(start: [number, number], end: [number, number], curvature: number) {
  const mx = (start[0] + end[0]) / 2;
  const my = (start[1] + end[1]) / 2;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = mx + nx * curvature * dist;
  const cy = my + ny * curvature * dist;
  return `M ${start[0]} ${start[1]} Q ${cx} ${cy} ${end[0]} ${end[1]}`;
}

export function WorldMap() {
  const [showChina, setShowChina] = useState(false);
  const [showSingapore, setShowSingapore] = useState(false);

  const mapSize = { width: 980, height: 520 };

  const projection = useMemo(() => {
    // Keep this aligned with ComposableMap projectionConfig.
    return geoMercator()
      .scale(180)
      .center([80, 20])
      .translate([mapSize.width / 2, mapSize.height / 2]);
  }, [mapSize.width, mapSize.height]);

  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, []);

  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) => {
        if (node.id === "factory-china") return showChina;
        if (node.id === "factory-singapore") return showSingapore;
        return true;
      }),
    [showChina, showSingapore]
  );

  const visibleRoutes = useMemo(
    () =>
      routes.filter((route) => {
        if (route.fromNodeId === "factory-china") return showChina;
        if (route.fromNodeId === "factory-singapore") return showSingapore;
        return true;
      }),
    [showChina, showSingapore]
  );


  return (
    <div className="relative w-full h-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 180,
          center: [80, 20]
        }}
        width={mapSize.width}
        height={mapSize.height}
        className="w-full h-full"
      >
        <ZoomableGroup center={[80, 20]} zoom={1}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const isHighDemand =
                  ["Taiwan", "South Korea", "Japan", "Singapore", "Malaysia", "China", "United States of America", "Germany", "Netherlands", "France", "United Kingdom", "Italy"].includes(
                    geo.properties.name
                  );
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={
                      isHighDemand ? "#fee2e2" :
                      "#e5e7eb"
                    }
                    stroke="#9ca3af"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#cbd5e1", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Shipping routes with flowing containers */}
          <defs>
            {visibleRoutes.map((route) => {
              const from = nodeById.get(route.fromNodeId);
              const to = nodeById.get(route.toNodeId);
              if (!from || !to) return null;
              const start = projection(from.coordinates);
              const end = projection(to.coordinates);
              if (!start || !end) return null;
              const curvature = from.kind === "factory_planned" ? 0.18 : 0.12;
              const pathD = arcPath(start as [number, number], end as [number, number], curvature);
              return <path key={route.id} id={`route-${route.id}`} d={pathD} fill="none" />;
            })}
          </defs>
          <g>
            {visibleRoutes.map((route) => {
              const from = nodeById.get(route.fromNodeId);
              const to = nodeById.get(route.toNodeId);
              if (!from || !to) return null;

              const start = projection(from.coordinates);
              const end = projection(to.coordinates);
              if (!start || !end) return null;

              const curvature = from.kind === "factory_planned" ? 0.18 : 0.12;
              const pathD = arcPath(start as [number, number], end as [number, number], curvature);
              const { strokeWidth, opacity } = volumeToStyle(route.volume);
              const isPlanned = from.kind === "factory_planned";
              const routeColor = isPlanned ? "#f59e0b" : "#2563eb";
              const containerCount = route.volume === "high" ? 4 : route.volume === "medium" ? 3 : 2;
              const duration = route.volume === "high" ? 2.5 : route.volume === "medium" ? 3.5 : 4.5;

              return (
                <g key={route.id}>
                  {/* Route line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={routeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    strokeDasharray={isPlanned ? "6 6" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Flowing container icons */}
                  {Array.from({ length: containerCount }).map((_, i) => (
                    <g key={`${route.id}-c${i}`}>
                      <rect
                        x={-5}
                        y={-4}
                        width={10}
                        height={8}
                        rx={1}
                        fill={routeColor}
                        stroke={isPlanned ? "#d97706" : "#1e40af"}
                        strokeWidth={1}
                        opacity={0.9}
                      >
                        <animateMotion
                          dur={`${duration}s`}
                          repeatCount="indefinite"
                          begin={`${i * (duration / containerCount)}s`}
                          path={pathD}
                          rotate="auto"
                        />
                      </rect>
                    </g>
                  ))}
                </g>
              );
            })}
          </g>

          {/* Nodes (factories + customers) */}
          {visibleNodes.map((node) => (
            <Marker
              key={node.id}
              coordinates={node.coordinates}
            >
              {node.kind === "factory_current" ? (
                <>
                  <circle r={8} fill="#3b82f6" stroke="#1e40af" strokeWidth={2} />
                  <Factory
                    x={-10}
                    y={-30}
                    size={20}
                    className="text-blue-600"
                    strokeWidth={2}
                  />
                </>
              ) : node.kind === "factory_planned" ? (
                <>
                  <circle r={7} fill="#f59e0b" stroke="#d97706" strokeWidth={2} />
                  <Factory x={-10} y={-30} size={20} className="text-amber-600" strokeWidth={2} />
                </>
              ) : (
                <>
                  <circle r={7} fill="#ef4444" stroke="#b91c1c" strokeWidth={2} />
                  <MapPin x={-8} y={-26} size={16} className="text-red-600" strokeWidth={2} />
                </>
              )}
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Factory toggles */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2 flex gap-1.5 z-10" style={{ left: "40%", top: "46%" }}>
        <button
          onClick={() => setShowChina((prev) => !prev)}
          className="w-6 h-6 rounded-full text-[10px] font-bold cursor-pointer border border-white/20 bg-white/10 text-white/30"
          title={showChina ? "Hide China factory" : "Show China factory"}
          aria-label="Toggle China factory"
        >C</button>
        <button
          onClick={() => setShowSingapore((prev) => !prev)}
          className="w-6 h-6 rounded-full text-[10px] font-bold cursor-pointer border border-white/20 bg-white/10 text-white/30"
          title={showSingapore ? "Hide Singapore factory" : "Show Singapore factory"}
          aria-label="Toggle Singapore factory"
        >S</button>
      </div>
    </div>
  );
}
