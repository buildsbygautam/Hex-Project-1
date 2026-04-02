import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import RawDataViewer, { type RawApiData } from './RawDataViewer';
import SubdomainsViewer from './SubdomainsViewer';

interface TargetOverviewProps {
  target: string;
  geoData: string | null;
  shodanData: string | null;
  riskScore: number;
  isLoading?: boolean;
  rawApiData?: RawApiData;
  subdomains?: string[];
  isPremium?: boolean;
}

// Internal component for the Map to isolate potential Leaflet crashes
const SafeMap = ({ lat, lon, target, score }: { lat: number, lon: number, target: string, score: number }) => {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure container is fully rendered in DOM
    const timer = setTimeout(() => setMapReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!mapReady) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-green-500/50">
        <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-400 rounded-full animate-spin mb-2"></div>
        <span className="text-[10px] uppercase tracking-widest">Initializing Map...</span>
      </div>
    );
  }

  // Safe icon initialization
  const mapIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <MapContainer center={[lat, lon]} zoom={4} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lon]} icon={mapIcon}>
        <Popup>
          <div className="text-xs font-mono">
            <strong>{target}</strong><br/>
            Risk Score: {score}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
};

// Error Boundary-like protection for the Map section
class MapErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error("Map Section Crashed:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4 text-center">
          <span className="text-blue-400 text-xs mb-2">Notice: Static Map View</span>
          <p className="text-[10px] text-gray-500 max-w-[150px]">The interactive map layer has been optimized. Geographic statistics are still available in the findings below.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const TargetOverview: React.FC<TargetOverviewProps> = ({ target, geoData, shodanData, riskScore, isLoading, rawApiData, subdomains, isPremium }) => {
  const [showRawData, setShowRawData] = useState(false);
  const [showSubdomains, setShowSubdomains] = useState(false);
  // Extract coordinates with a more flexible regex (supports integers and decimals)
  let lat = 0, lon = 0;
  let hasCoords = false;
  if (geoData && typeof geoData === 'string') {
    const coordsMatch = geoData.match(/Coordinates: (-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (coordsMatch) {
      const pLat = parseFloat(coordsMatch[1]);
      const pLon = parseFloat(coordsMatch[2]);
      if (!isNaN(pLat) && !isNaN(pLon)) {
        lat = pLat;
        lon = pLon;
        hasCoords = true;
      }
    }
  }

  // Extract ports and vulns
  let ports = 'N/A';
  let vulns = 'N/A';
  let whoisInfo = 'N/A';
  let isDomain = !/^\d{1,3}(\.\d{1,3}){3}$/.test(target);

  // Extract infrastructure/domain info
  if (shodanData && typeof shodanData === 'string') {
    if (shodanData.includes('SHODAN DATA')) {
      const portsMatch = shodanData.match(/Open Ports: (.+)/);
      if (portsMatch) ports = portsMatch[1];
      
      const vulnsMatch = shodanData.match(/Known Vulnerabilities \(CVEs\): (.+)/);
      if (vulnsMatch) vulns = vulnsMatch[1];
    } else if (shodanData.includes('WHOIS DATA')) {
      const registrarMatch = shodanData.match(/Registrar: (.+)/);
      const createdMatch = shodanData.match(/Created: (.+)/);
      if (registrarMatch) {
        whoisInfo = registrarMatch[1].trim();
        if (createdMatch) {
          whoisInfo += ` (Est. ${createdMatch[1].trim()})`;
        }
      }
    }
  }

  // Determine risk color
  const riskColor = riskScore >= 70 ? 'text-red-500' : riskScore >= 40 ? 'text-orange-500' : riskScore >= 20 ? 'text-yellow-500' : 'text-green-500';
  const riskBg = riskScore >= 70 ? 'bg-red-500' : riskScore >= 40 ? 'bg-orange-500' : riskScore >= 20 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <>
    <div className="w-full bg-black/60 border border-green-500/20 rounded-lg p-4 mb-4 flex flex-col md:flex-row gap-4">
      {/* Left side: Stats & Gauges */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xl font-bold text-white">Target Intelligence: {target}</h3>
        
          <div className="flex items-center gap-2">
            {/* Subdomains Button - Premium Only */}
            {isDomain && (
              <button
                onClick={() => isPremium ? setShowSubdomains(true) : null}
                disabled={!isPremium}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                  isPremium 
                    ? "border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-900/20" 
                    : "border-gray-500/20 bg-gray-500/5 text-gray-500 cursor-not-allowed"
                } group`}
                title={isPremium ? `${subdomains?.length || 0} Subdomains found` : "Premium feature: Subdomain Discovery"}
              >
                <span className="text-sm">{isPremium ? "🌐" : "🔒"}</span>
                <span className="hidden sm:inline">Subdomains</span>
                {isPremium && <span className="bg-green-500/20 px-1.5 py-0.5 rounded text-[10px]">{subdomains?.length || 0}</span>}
              </button>
            )}

            {/* Raw Data Button - Premium Only */}
            {rawApiData && (Object.values(rawApiData).some(v => v !== null && v !== undefined)) && (
            <button
              onClick={() => isPremium ? setShowRawData(true) : null}
              disabled={!isPremium}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                isPremium
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-900/20"
                  : "border-gray-500/20 bg-gray-500/5 text-gray-500 cursor-not-allowed"
              } group`}
              title={isPremium ? "View raw API responses" : "Premium feature: Raw Data Access"}
            >
              <span className="text-sm">{isPremium ? "📊" : "🔒"}</span>
              <span className="hidden sm:inline">Raw Data</span>
              {isPremium && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse group-hover:animate-none" />}
            </button>
          )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center justify-center">
            <div className={`w-32 h-32 rounded-full border-4 ${isLoading ? 'animate-pulse border-blue-500/50' : 'border-gray-800'} flex items-center justify-center relative overflow-hidden`}>
              <div className={`absolute inset-0 ${riskBg} opacity-20`} style={{ height: `${riskScore}%`, top: 'auto' }} />
              <span className={`text-3xl font-bold ${isLoading ? 'text-blue-400' : riskColor}`}>
                {isLoading ? '...' : riskScore}
              </span>
            </div>
            <span className="text-[10px] text-gray-500 mt-2 uppercase tracking-[0.2em]">
              {isLoading ? 'Scanning Engine' : 'Risk Level'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 flex-1 h-32">
            <div className="bg-black/50 p-3 rounded border border-gray-800 flex flex-col justify-center">
              <span className="text-gray-400 text-xs uppercase tracking-wider mb-2">Target Info</span>
              <div className="text-sm">
                <span className="text-gray-500">Host:</span> <span className="text-white truncate block">{target}</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-gray-500">Status:</span> <span className={isLoading ? "text-blue-400 animate-pulse" : "text-green-400"}>{isLoading ? "Fetching Intel..." : "Active"}</span>
              </div>
            </div>
            <div className="bg-black/50 p-3 rounded border border-gray-800 flex flex-col justify-center">
              <span className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                {isDomain ? 'Domain Analytics' : 'Attack Surface'}
              </span>
              <div className="text-sm">
                <span className="text-gray-500">{isDomain ? 'Registrar:' : 'Ports:'}</span>{' '}
                <span className="text-blue-400 break-all">{isDomain ? whoisInfo : ports}</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-gray-500">{isDomain ? 'Threats:' : 'CVEs:'}</span>{' '}
                <span className={riskScore > 30 ? 'text-red-400 font-bold' : 'text-orange-400'}>
                  {riskScore > 0 ? `${riskScore}% Intensity` : 'Scan Complete'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Enrichment - Advanced Indicators */}
        {isPremium && rawApiData?.virustotal && (rawApiData.virustotal.threatActors?.length > 0 || rawApiData.virustotal.significantTags?.length > 0) && (
          <div className="mt-4 pt-3 border-t border-red-500/10 animate-in fade-in slide-in-from-bottom-2 duration-1000">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-shodan" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Advanced Threat Intelligence</span>
             </div>
             
             <div className="flex flex-wrap gap-2 mb-3">
                {rawApiData.virustotal.threatActors?.map((actor: string, id: number) => (
                  <div key={`actor-${id}`} className="px-2 py-1 rounded bg-red-950/40 border border-red-500/30 text-[10px] font-mono text-white uppercase tracking-tighter shadow-sm shadow-red-500/10">
                    🚩 {actor}
                  </div>
                ))}
                {rawApiData.virustotal.significantTags?.map((tag: string, id: number) => (
                  <div key={`tag-${id}`} className="px-2 py-1 rounded bg-orange-950/40 border border-orange-500/30 text-[10px] font-mono text-orange-200 uppercase tracking-tighter">
                    🏷️ {tag}
                  </div>
                ))}
             </div>

             {/* Threat Translation for Humans */}
             <div className="bg-red-500/5 p-2 rounded border border-red-500/10 text-[9px] font-medium leading-relaxed uppercase tracking-tight">
                <p className="text-red-400 mb-1">🔍 Intelligence Summary:</p>
                <p className="text-gray-400">
                  {rawApiData.virustotal.significantTags?.some((t: string) => t.includes('c2')) && "• Command & Control (C2) handshake detected - active threat control link identified. "}
                  {rawApiData.virustotal.significantTags?.some((t: string) => t.includes('nxdomain')) && "• NXDOMAIN/DGA activity detected - potential automated malware heartbeat behavior. "}
                  {rawApiData.virustotal.significantTags?.some((t: string) => t.includes('phishing')) && "• Phishing heuristics triggered - domain structure matches known identity-theft patterns. "}
                  {rawApiData.virustotal.significantTags?.some((t: string) => t.includes('malware')) && "• Direct malware payload association confirmed by cross-engine scans. "}
                  {rawApiData.virustotal.threatActors?.length > 0 && "• ATTRIBUTION: Target belongs to an official threat-actor watch-list."}
                  {(!rawApiData.virustotal.threatActors?.length && !rawApiData.virustotal.significantTags?.length) && "Analyzing behavioral indicators for anomalies..."}
                </p>
             </div>
          </div>
        )}
      </div>

      {/* Right side: Interactive Map Section with Shielding */}
      <div className="w-full md:w-1/2 rounded border border-gray-800 overflow-hidden relative z-0" style={{ height: '300px' }}>
        {!hasCoords ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
            Map data unavailable
          </div>
        ) : (
          <MapErrorBoundary>
            <SafeMap lat={lat} lon={lon} target={target} score={riskScore} />
          </MapErrorBoundary>
        )}
      </div>
    </div>

      {/* Global Modals for this Target */}
      {showRawData && (
        <RawDataViewer 
          isOpen={showRawData}
          data={rawApiData || {}} 
          target={target} 
          onClose={() => setShowRawData(false)} 
        />
      )}

      {showSubdomains && subdomains && (
        <SubdomainsViewer
          subdomains={subdomains}
          target={target}
          onClose={() => setShowSubdomains(false)}
        />
      )}
    </>
  );
};

export default TargetOverview;
