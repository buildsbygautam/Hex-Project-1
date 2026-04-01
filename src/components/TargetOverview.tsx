import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';

// Define the icon safely
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface TargetOverviewProps {
  target: string;
  geoData: string | null;
  shodanData: string | null;
  riskScore: number;
}

export default function TargetOverview({ target, geoData, shodanData, riskScore }: TargetOverviewProps) {
  // Extract coordinates
  let lat = 0, lon = 0;
  let hasCoords = false;
  if (geoData) {
    const coordsMatch = geoData.match(/Coordinates: (-?\d+\.\d+),_? (-?\d+\.\d+)/) || geoData.match(/Coordinates: (-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (coordsMatch) {
      lat = parseFloat(coordsMatch[1]);
      lon = parseFloat(coordsMatch[2]);
      hasCoords = true;
    }
  }

  // Extract ports and vulns
  let ports = 'N/A';
  let vulns = 'N/A';
  if (shodanData && shodanData.includes('SHODAN DATA')) {
    const portsMatch = shodanData.match(/Open Ports: (.+)/);
    if (portsMatch) ports = portsMatch[1];
    
    const vulnsMatch = shodanData.match(/Known Vulnerabilities \(CVEs\): (.+)/);
    if (vulnsMatch) vulns = vulnsMatch[1];
  }

  // Determine risk color
  const riskColor = riskScore >= 70 ? 'text-red-500' : riskScore >= 40 ? 'text-orange-500' : riskScore >= 20 ? 'text-yellow-500' : 'text-green-500';
  const riskBg = riskScore >= 70 ? 'bg-red-500' : riskScore >= 40 ? 'bg-orange-500' : riskScore >= 20 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="w-full bg-black/60 border border-green-500/20 rounded-lg p-4 mb-4 flex flex-col md:flex-row gap-4">
      {/* Left side: Stats & Gauges */}
      <div className="flex-1 space-y-4">
        <h3 className="text-xl font-bold text-white mb-2">Target Intelligence: {target}</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/50 p-3 rounded border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-gray-400 text-xs uppercase tracking-wider mb-1">Risk Score</span>
            <div className={`text-4xl font-mono font-bold ${riskColor}`}>
              {riskScore}
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full mt-3 overflow-hidden">
              <div className={`h-full ${riskBg} transition-all duration-1000`} style={{ width: `${riskScore}%` }}></div>
            </div>
          </div>
          
          <div className="bg-black/50 p-3 rounded border border-gray-800 flex flex-col justify-center">
            <span className="text-gray-400 text-xs uppercase tracking-wider mb-2">Attack Surface</span>
            <div className="text-sm">
              <span className="text-gray-500">Ports:</span>{' '}
              <span className="text-blue-400 break-all">{ports}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="text-gray-500">CVEs:</span>{' '}
              <span className={vulns === 'None detected' || vulns === 'N/A' ? 'text-green-400' : 'text-red-400'}>
                {vulns}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Interactive Map */}
      <div className="w-full md:w-1/2 min-h-[250px] md:h-auto rounded border border-gray-800 overflow-hidden relative z-0">
        {!hasCoords ? (
          <div className="w-full h-full min-h-[250px] flex items-center justify-center bg-gray-900 text-gray-500">
            Map data unavailable
          </div>
        ) : (
          <MapContainer 
            center={[lat, lon]} 
            zoom={4} 
            scrollWheelZoom={false} 
            style={{ height: '100%', width: '100%', zIndex: 0 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[lat, lon]} icon={defaultIcon}>
              <Popup>
                {target} <br /> Risk: {riskScore}
              </Popup>
            </Marker>
          </MapContainer>
        )}
      </div>
    </div>
  );
}
