              {drawing && draftPath.map((point, index) => (
                <Marker key={`draft-${index}`} position={point} />
              ))}import React, { useCallback, useMemo, useState } from 'react';
import { APIProvider, Map, Marker, Polygon } from '@vis.gl/react-google-maps';
import {
  Building2,
  Check,
  Crosshair,
  Filter,
  Layers,
  Megaphone,
  MousePointer2,
  PhoneCall,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { Property } from '../types';

interface MapProperty extends Property {
  owner_entity_type?: string;
  owner_mailing_address?: string;
  owner_phone_numbers?: Array<{ number: string; type?: string; dnc_status?: boolean; confidence?: number }>;
  owner_email_addresses?: Array<{ email: string; verified?: boolean; confidence?: number }>;
  parcel_geometry?: { type?: string; rings?: number[][][]; coordinates?: any };
  map_signals?: string[];
  hazard_flags?: string[];
  tags?: string[];
  has_lead?: boolean;
  lead_id?: string | null;
}

interface LatLng {
  lat: number;
  lng: number;
}

interface NativeMapViewProps {
  onNavigate: (view: string) => void;
  onOpenInspector?: (contentType: any, data: any) => void;
}

const DEFAULT_CENTER: LatLng = { lat: 33.7175, lng: -117.8311 };

const LAYERS = [
  { id: 'properties', label: 'Properties', icon: Building2 },
  { id: 'owners', label: 'Owners', icon: Users },
  { id: 'leads', label: 'Leads', icon: Sparkles },
  { id: 'parcels', label: 'Parcels', icon: Layers },
  { id: 'boundaries', label: 'Boundaries', icon: MapPin },
  { id: 'signals', label: 'Signals', icon: Search },
  { id: 'hazards', label: 'Hazard zones', icon: ShieldAlert },
] as const;

export const NativeMapView: React.FC<NativeMapViewProps> = ({ onNavigate, onOpenInspector }) => {
  const { activeTenant, userProfile, getAuthHeaders } = useAuth();
  const { addToast } = useToast();
  const organizationId = activeTenant?.id || userProfile?.organization_id;
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

  const [mapProperties, setMapProperties] = useState<MapProperty[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<MapProperty | null>(null);
  const [draftPath, setDraftPath] = useState<LatLng[]>([]);
  const [searchPolygon, setSearchPolygon] = useState<LatLng[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [layers, setLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(LAYERS.map((layer) => [layer.id, true])),
  );
  const [showFilters, setShowFilters] = useState(true);
  const [minEquity, setMinEquity] = useState('');
  const [maxEquity, setMaxEquity] = useState('');
  const [propertyType, setPropertyType] = useState('All');
  const [absenteeOnly, setAbsenteeOnly] = useState(false);
  const [corporateOnly, setCorporateOnly] = useState(false);
  const [taxDelinquentOnly, setTaxDelinquentOnly] = useState(false);
  const [campaignBusy, setCampaignBusy] = useState(false);

  const mapCenter = useMemo<LatLng>(() => {
    if (mapProperties.length > 0) {
      const points = mapProperties.filter((p) => p.latitude != null && p.longitude != null);
      if (points.length > 0) {
        return {
          lat: Number(points.reduce((sum, p) => sum + Number(p.latitude), 0) / points.length),
          lng: Number(points.reduce((sum, p) => sum + Number(p.longitude), 0) / points.length),
        };
      }
    }
    return DEFAULT_CENTER;
  }, [mapProperties]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }, []);

  const searchArea = useCallback(async (polygon: LatLng[]) => {
    if (!organizationId || polygon.length < 3) return;
    setLoading(true);
    try {
      const closed = polygon[0].lat === polygon[polygon.length - 1].lat && polygon[0].lng === polygon[polygon.length - 1].lng
        ? polygon
        : [...polygon, polygon[0]];
      const geoJson = {
        type: 'Polygon',
        coordinates: [closed.map((point) => [point.lng, point.lat])],
      };

      const response = await fetch('/api/map/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), 'x-organization-id': organizationId },
        body: JSON.stringify({
          polygon: geoJson,
          minEquity: minEquity ? Number(minEquity) : undefined,
          maxEquity: maxEquity ? Number(maxEquity) : undefined,
          propertyType,
          absenteeOnly,
          corporateOnly,
          taxDelinquentOnly,
          limit: 1000,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Map search failed');

      setMapProperties(data.properties || []);
      setSelectedIds([]);
      setSelectedProperty(null);
      addToast(`Spatial search found ${data.properties?.length || 0} properties.`, 'success');
    } catch (error: any) {
      addToast(error?.message || 'Spatial map search failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    organizationId,
    getAuthHeaders,
    minEquity,
    maxEquity,
    propertyType,
    absenteeOnly,
    corporateOnly,
    taxDelinquentOnly,
    addToast,
  ]);

  const handleMapClick = useCallback((event: any) => {
    const latLng = event?.detail?.latLng;
    if (!drawing || !latLng) return;
    setDraftPath((current) => [...current, { lat: latLng.lat, lng: latLng.lng }]);
  }, [drawing]);

  const finishDrawing = useCallback(() => {
    if (draftPath.length < 3) {
      addToast('Add at least three points to draw a search area.', 'error');
      return;
    }
    setSearchPolygon(draftPath);
    setDrawing(false);
    void searchArea(draftPath);
  }, [draftPath, searchArea, addToast]);

  const createCampaign = useCallback(async () => {
    if (!organizationId || selectedIds.length === 0) return;
    setCampaignBusy(true);
    try {
      const selected = mapProperties.filter((p) => selectedIds.includes(p.id));
      const contacts: Array<Record<string, any>> = [];

      for (const property of selected) {
        let leadId = property.lead_id || undefined;
        if (!leadId) {
          const leadResponse = await fetch(`/api/properties/${encodeURIComponent(property.id)}/create-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), 'x-organization-id': organizationId },
          });
          const leadData = await leadResponse.json();
          if (!leadResponse.ok) throw new Error(leadData.error || `Unable to create lead for ${property.address}`);
          leadId = leadData.leadId;
        }

        const phone = Array.isArray(property.owner_phone_numbers)
          ? property.owner_phone_numbers.find((item) => item?.dnc_status !== true)?.number
          : undefined;
        if (phone) {
          contacts.push({
            lead_id: leadId,
            contact_name: property.owner_name || 'Property Owner',
            phone_number: phone,
            property_address: property.address,
          });
        }
      }

      if (contacts.length === 0) {
        throw new Error('Selected properties have no eligible owner phone numbers. Enrich the owners before dialing.');
      }

      const campaignResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), 'x-organization-id': organizationId },
        body: JSON.stringify({
          name: `Map Territory • ${new Date().toLocaleDateString()}`,
          description: 'Campaign created from Vortex One native Property Intelligence map selection.',
          target_market: 'Map-selected territory',
          total_contacts: contacts.length,
          contacts,
        }),
      });
      const campaign = await campaignResponse.json();
      if (!campaignResponse.ok) throw new Error(campaign.error || 'Campaign creation failed');

      addToast(`Campaign created with ${contacts.length} contacts.`, 'success');
      onNavigate('campaigns');
    } catch (error: any) {
      addToast(error?.message || 'Unable to create campaign from map selection.', 'error');
    } finally {
      setCampaignBusy(false);
    }
  }, [organizationId, selectedIds, mapProperties, getAuthHeaders, addToast, onNavigate]);

  if (!apiKey) {
    return (
      <div className="min-h-full p-6 bg-slate-50">
        <div className="max-w-4xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-extrabold text-slate-900">Native Property Intelligence Map</h1>
          <p className="mt-2 text-sm text-slate-700">
            The native map UI is installed, but <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> is not configured.
          </p>
          <p className="mt-3 text-xs text-slate-600">
            Add the browser-restricted Google Maps key to the frontend environment, then reload Vortex One. Spatial search remains database-backed through PostGIS.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[760px] flex flex-col bg-slate-950 text-white">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <h1 className="text-base font-extrabold tracking-tight">Vortex One Property Intelligence Map</h1>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">POSTGIS</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Draw a territory → find properties → inspect owners → create leads → create campaign → dial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDrawing(true);
              setDraftPath([]);
              setSelectedProperty(null);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${drawing ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-cyan-500'}`}
          >
            <MousePointer2 className="w-3.5 h-3.5 inline mr-1.5" />
            {drawing ? 'Drawing…' : 'Draw Search Area'}
          </button>
          {drawing && (
            <button
              onClick={finishDrawing}
              disabled={draftPath.length < 3}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5 inline mr-1.5" /> Search Area
            </button>
          )}
          <button
            onClick={() => setShowFilters((value) => !value)}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-slate-200"
          >
            <Filter className="w-3.5 h-3.5 inline mr-1.5" /> Filters
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950/95 p-3 overflow-y-auto space-y-3">
          {showFilters && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-3">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">Territory Filters</div>
              <label className="block text-[11px] text-slate-400">Minimum equity<input value={minEquity} onChange={(e) => setMinEquity(e.target.value)} placeholder="$500000" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white" /></label>
              <label className="block text-[11px] text-slate-400">Maximum equity<input value={maxEquity} onChange={(e) => setMaxEquity(e.target.value)} placeholder="No limit" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white" /></label>
              <label className="block text-[11px] text-slate-400">Property type<select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white"><option>All</option><option>Single Family</option><option>Multi-Family</option><option>Commercial</option><option>Condo</option><option>Industrial</option></select></label>
              <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={absenteeOnly} onChange={(e) => setAbsenteeOnly(e.target.checked)} /> Absentee owners</label>
              <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={corporateOnly} onChange={(e) => setCorporateOnly(e.target.checked)} /> Corporate owners</label>
              <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={taxDelinquentOnly} onChange={(e) => setTaxDelinquentOnly(e.target.checked)} /> Tax delinquent</label>
              <div className="text-[10px] text-slate-500">Filters apply when you run a new polygon search.</div>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-2">Map Layers</div>
            <div className="space-y-1">
              {LAYERS.map((layer) => {
                const Icon = layer.icon;
                return (
                  <button key={layer.id} onClick={() => setLayers((current) => ({ ...current, [layer.id]: !current[layer.id] }))} className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-slate-800 text-left">
                    <span className="flex items-center gap-2 text-xs text-slate-300"><Icon className="w-3.5 h-3.5" />{layer.label}</span>
                    <span className={`w-2 h-2 rounded-full ${layers[layer.id] ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">Results</span>
              <span className="text-xs font-bold text-cyan-300">{mapProperties.length}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {selectedIds.length} selected
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button disabled={!selectedIds.length || campaignBusy} onClick={() => void createCampaign()} className="rounded-lg bg-cyan-500 text-slate-950 px-2 py-2 text-[10px] font-extrabold disabled:opacity-40">
                <Megaphone className="w-3.5 h-3.5 inline mr-1" /> Campaign
              </button>
              <button disabled={!selectedIds.length} onClick={() => onNavigate('dialer')} className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-[10px] font-extrabold disabled:opacity-40">
                <PhoneCall className="w-3.5 h-3.5 inline mr-1" /> Dialer
              </button>
            </div>
          </div>

          {selectedProperty && (
            <div className="rounded-xl border border-cyan-800 bg-cyan-950/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400">Selected parcel</div>
                  <div className="text-xs font-bold mt-1 text-white">{selectedProperty.address}</div>
                </div>
                <button onClick={() => setSelectedProperty(null)}><X className="w-3.5 h-3.5 text-slate-500" /></button>
              </div>
              <div className="mt-2 space-y-1 text-[10px] text-slate-300">
                <div>APN: <span className="font-mono">{selectedProperty.apn}</span></div>
                <div>Owner: {selectedProperty.owner_name || 'Unknown'}</div>
                <div>Equity: ${Number(selectedProperty.estimated_equity || 0).toLocaleString()}</div>
                <div>Lead: {selectedProperty.has_lead ? 'Created' : 'Not created'}</div>
              </div>
              <button onClick={() => onOpenInspector?.('property', selectedProperty)} className="mt-3 w-full rounded-lg bg-white text-slate-950 px-2 py-2 text-[10px] font-extrabold">
                Open Property Intelligence
              </button>
            </div>
          )}
        </aside>

        <div className="relative flex-1 min-w-0">
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={mapCenter}
              defaultZoom={11}
              gestureHandling="greedy"
              disableDefaultUI={false}
              onClick={handleMapClick}
              className="w-full h-full"
            >
              {layers.parcels && mapProperties.map((property) => {
                const rings = property.parcel_geometry?.rings;
                if (!Array.isArray(rings) || rings.length === 0) return null;
                const path = rings[0].map((point) => ({ lat: Number(point[1]), lng: Number(point[0]) }));
                return (
                  <Polygon
                    key={`parcel-${property.id}`}
                    paths={path}
                    options={{
                      strokeColor: selectedIds.includes(property.id) ? '#06b6d4' : '#334155',
                      strokeOpacity: 0.8,
                      strokeWeight: selectedIds.includes(property.id) ? 2 : 1,
                      fillColor: selectedIds.includes(property.id) ? '#06b6d4' : '#64748b',
                      fillOpacity: selectedIds.includes(property.id) ? 0.25 : 0.08,
                      clickable: true,
                    }}
                    onClick={() => {
                      setSelectedProperty(property);
                      toggleSelection(property.id);
                    }}
                  />
                );
              })}

              {layers.properties && mapProperties.map((property) => {
                if (property.latitude == null || property.longitude == null) return null;
                return (
                  <Marker
                    key={property.id}
                    position={{ lat: Number(property.latitude), lng: Number(property.longitude) }}
                    title={property.address}
                    onClick={() => {
                      setSelectedProperty(property);
                      toggleSelection(property.id);
                    }}
                  />
                );
              })}

              {searchPolygon.length >= 3 && (
                <Polygon
                  paths={searchPolygon}
                  options={{
                    strokeColor: '#06b6d4',
                    strokeOpacity: 1,
                    strokeWeight: 2,
                    fillColor: '#06b6d4',
                    fillOpacity: 0.08,
                    clickable: false,
                  }}
                />
              )}

              {drawing && draftPath.map((point, index) => (
                <Marker key={`draft-${index}`} position={point} title={`Polygon point ${index + 1}`} />
              ))}
            </Map>
          </APIProvider>

          {loading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/90 border border-cyan-800 px-4 py-2 text-[11px] font-bold text-cyan-300">
              Searching PostGIS spatial index…
            </div>
          )}

          {drawing && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-slate-950/95 border border-cyan-700 px-4 py-3 text-[11px] text-slate-300 shadow-xl">
              Click the map to add polygon points. Add 3+ points, then select <strong className="text-white">Search Area</strong>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NativeMapView;
