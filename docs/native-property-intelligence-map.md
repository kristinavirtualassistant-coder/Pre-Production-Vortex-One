# Native Property Intelligence Map

Vortex One's native map is a tenant-scoped spatial workflow built on PostGIS.

## Flow

`Draw polygon → spatial parcel search → owner filtering → enrichment → lead creation → campaign → dialer`

## Spatial model

Properties store:

- `latitude` / `longitude`
- `location geography(Point, 4326)`
- `parcel_geometry`
- `map_signals`
- `hazard_flags`

The `location` column has a GiST index. Polygon searches are executed with PostGIS `ST_Intersects` and a bounded PostgreSQL statement timeout.

## Security boundaries

- Organization identity comes from the authenticated database user.
- Client-provided organization identifiers are not trusted.
- Spatial queries include the organization predicate.
- Owner joins include the same organization predicate.
- Polygon complexity is bounded before database execution.
- Results are capped at 2,000 rows.
- Campaign creation requires the existing campaign-management RBAC policy.
- Map campaign creation verifies that every requested contact was durably attached.

## Data sources

County ArcGIS providers remain the ingestion source for cadastral geometry and public property data. Geometry is normalized toward WGS84/4326 for browser and PostGIS interoperability.

## Browser map

The UI uses `@vis.gl/react-google-maps`. Configure `VITE_GOOGLE_MAPS_API_KEY` with HTTP-referrer restrictions. The browser key is public configuration, not a server credential.

## Layer roadmap

| Layer | Current state |
|---|---|
| Properties | Native map markers |
| Parcels | Native parcel polygons when geometry is available |
| Owners | Returned with tenant-scoped property results |
| Leads | Existing lead status and ID |
| Search area | User-drawn GeoJSON Polygon |
| Signals | Storage/UI foundation |
| Boundaries | Layer foundation; dataset integration pending |
| Hazard zones | Storage/UI foundation; authoritative dataset integration pending |

## Production next step

Populate the Signals, Boundaries, and Hazard datasets from authoritative sources and expose them as independently queryable spatial layers. Keep global reference datasets separate from tenant-owned CRM records.
