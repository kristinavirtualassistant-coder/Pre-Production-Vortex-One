import { requireOrganizationId } from '../organizationContext';
/**
 * Vortex One - Unified Property Data Provider Architecture
 * Orchestrates government GIS/Assessor and commercial data providers.
 */

import {
  IPropertyDataProvider,
  PropertySearchQuery,
  NormalizedPropertyResult,
  PropertySearchResponse,
} from './types';
import { OrangeCountyGISProvider } from './OrangeCountyGISProvider';
import { LosAngelesCountyGISProvider } from './LosAngelesCountyGISProvider';
import { SanDiegoCountyGISProvider } from './SanDiegoCountyGISProvider';
import { RiversideCountyGISProvider } from './RiversideCountyGISProvider';
import { SanBernardinoCountyGISProvider } from './SanBernardinoCountyGISProvider';
import { VenturaCountyGISProvider } from './VenturaCountyGISProvider';
import { SantaClaraCountyGISProvider } from './SantaClaraCountyGISProvider';
import { AlamedaCountyGISProvider } from './AlamedaCountyGISProvider';
import { SacramentoCountyGISProvider } from './SacramentoCountyGISProvider';
import { AttomDataProvider } from './AttomDataProvider';
import { NetrOnlineProvider } from './NetrOnlineProvider';
import { ZillowProvider } from './ZillowProvider';
import { RealtorProvider } from './RealtorProvider';
import { RedfinProvider } from './RedfinProvider';
import { ZoomInfoProvider } from './ZoomInfoProvider';
import { ArcGISServerProvider } from './ArcGISServerProvider';
import { GoogleMapsProvider } from './GoogleMapsProvider';
import { inMemoryStore, getPgPool } from '../../db/db';
import { AuditLogEntry } from '../../../src/types';
import { taskCacheService } from '../cacheService';
import { externalWebhookService, buildPropertyDiscoveredPayload } from '../externalWebhookService';

export class UnifiedPropertyDataProvider {
  private orangeCountyProvider: OrangeCountyGISProvider;
  private losAngelesCountyProvider: LosAngelesCountyGISProvider;
  private sanDiegoCountyProvider: SanDiegoCountyGISProvider;
  private riversideCountyProvider: RiversideCountyGISProvider;
  private sanBernardinoCountyProvider: SanBernardinoCountyGISProvider;
  private venturaCountyProvider: VenturaCountyGISProvider;
  private santaClaraCountyProvider: SantaClaraCountyGISProvider;
  private alamedaCountyProvider: AlamedaCountyGISProvider;
  private sacramentoCountyProvider: SacramentoCountyGISProvider;
  private attomProvider: AttomDataProvider;
  private netrOnlineProvider: NetrOnlineProvider;
  private zillowProvider: ZillowProvider;
  private realtorProvider: RealtorProvider;
  private redfinProvider: RedfinProvider;
  private zoomInfoProvider: ZoomInfoProvider;
  private arcGISServerProvider: ArcGISServerProvider;
  private googleMapsProvider: GoogleMapsProvider;

  constructor() {
    this.orangeCountyProvider = new OrangeCountyGISProvider();
    this.losAngelesCountyProvider = new LosAngelesCountyGISProvider();
    this.sanDiegoCountyProvider = new SanDiegoCountyGISProvider();
    this.riversideCountyProvider = new RiversideCountyGISProvider();
    this.sanBernardinoCountyProvider = new SanBernardinoCountyGISProvider();
    this.venturaCountyProvider = new VenturaCountyGISProvider();
    this.santaClaraCountyProvider = new SantaClaraCountyGISProvider();
    this.alamedaCountyProvider = new AlamedaCountyGISProvider();
    this.sacramentoCountyProvider = new SacramentoCountyGISProvider();
    this.attomProvider = new AttomDataProvider();
    this.netrOnlineProvider = new NetrOnlineProvider();
    this.zillowProvider = new ZillowProvider();
    this.realtorProvider = new RealtorProvider();
    this.redfinProvider = new RedfinProvider();
    this.zoomInfoProvider = new ZoomInfoProvider();
    this.arcGISServerProvider = new ArcGISServerProvider();
    this.googleMapsProvider = new GoogleMapsProvider();
  }

  /**
   * Routes the property search to the appropriate county GIS or commercial provider and normalizes results.
   */
  public async search(query: PropertySearchQuery): Promise<PropertySearchResponse> {
    const category = 'property_search';
    const inputPayload = {
      county: query.county,
      city: query.city,
      address: query.address,
      apn: query.apn,
      zip: query.zip,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      absenteeOnly: query.absenteeOnly,
      taxDelinquentOnly: query.taxDelinquentOnly,
      minSquareFeet: query.minSquareFeet,
      entityType: query.entityType,
      limit: query.limit,
      preferredProvider: query.preferredProvider,
    };

    const { result, isCached } = await taskCacheService.wrapTask(
      category,
      inputPayload,
      async () => {
        const startTime = Date.now();
        const warnings: string[] = [];
        let selectedProvider: IPropertyDataProvider;
        let providerNameUsed = '';

        // Route logic based on county name, city keywords, and address tokens
        const countyLower = (query.county || '').toLowerCase();
        const cityLower = (query.city || '').toLowerCase();
        const addressLower = (query.address || '').toLowerCase();

        const isOrangeCounty =
          countyLower.includes('orange') ||
          ['costa mesa', 'irvine', 'newport beach', 'santa ana', 'anaheim', 'huntington beach', 'orange', 'fullerton', 'mission viejo', 'laguna'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isLosAngelesCounty =
          countyLower.includes('los angeles') ||
          countyLower.includes('la county') ||
          ['los angeles', 'long beach', 'glendale', 'pasadena', 'burbank', 'torrance', 'santa monica', 'beverly hills', 'covina', 'van nuys', 'compton', 'downey'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isSanDiegoCounty =
          countyLower.includes('san diego') ||
          countyLower.includes('sd county') ||
          ['san diego', 'chula vista', 'oceanside', 'carlsbad', 'escondido', 'el cajon', 'encinitas', 'san marcos', 'vista', 'coronado', 'la mesa'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isRiversideCounty =
          countyLower.includes('riverside') ||
          ['riverside', 'moreno valley', 'corona', 'temecula', 'murrieta', 'palm springs', 'indio', 'menifee', 'hemet', 'lake elsinore', 'perris'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isSanBernardinoCounty =
          countyLower.includes('san bernardino') ||
          ['san bernardino', 'fontana', 'ontario', 'rancho cucamonga', 'victorville', 'rialto', 'hesperia', 'chino', 'chino hills', 'upland', 'apple valley', 'redlands'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isVenturaCounty =
          countyLower.includes('ventura') ||
          ['ventura', 'oxnard', 'thousand oaks', 'simi valley', 'camarillo', 'moorpark', 'santa paula', 'port hueneme', 'ojai', 'fillmore'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isSantaClaraCounty =
          countyLower.includes('santa clara') ||
          countyLower.includes('silicon valley') ||
          ['san jose', 'sunnyvale', 'santa clara', 'mountain view', 'palo alto', 'cupertino', 'milpitas', 'gilroy', 'campbell', 'morgan hill', 'los gatos'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isAlamedaCounty =
          countyLower.includes('alameda') ||
          countyLower.includes('east bay') ||
          ['oakland', 'fremont', 'hayward', 'berkeley', 'san leandro', 'livermore', 'alameda', 'pleasanton', 'union city', 'dublin', 'newark'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        const isSacramentoCounty =
          countyLower.includes('sacramento') ||
          ['sacramento', 'elk grove', 'roseville', 'citrus heights', 'folsom', 'rancho cordova', 'galt', 'isleton'].some(
            (c) => cityLower.includes(c) || addressLower.includes(c)
          );

        // Provider matching
        if (query.preferredProvider === 'attom') {
          selectedProvider = this.attomProvider;
        } else if (query.preferredProvider === 'netr_online') {
          selectedProvider = this.netrOnlineProvider;
        } else if (query.preferredProvider === 'zillow') {
          selectedProvider = this.zillowProvider;
        } else if (query.preferredProvider === 'realtor') {
          selectedProvider = this.realtorProvider;
        } else if (query.preferredProvider === 'redfin') {
          selectedProvider = this.redfinProvider;
        } else if (query.preferredProvider === 'zoominfo') {
          selectedProvider = this.zoomInfoProvider;
        } else if (query.preferredProvider === 'arcgis') {
          selectedProvider = this.arcGISServerProvider;
        } else if (query.preferredProvider === 'google_maps') {
          selectedProvider = this.googleMapsProvider;
        } else if (query.preferredProvider === 'san_diego_county_gis' || isSanDiegoCounty) {
          selectedProvider = this.sanDiegoCountyProvider;
        } else if (query.preferredProvider === 'riverside_county_gis' || isRiversideCounty) {
          selectedProvider = this.riversideCountyProvider;
        } else if (query.preferredProvider === 'san_bernardino_county_gis' || isSanBernardinoCounty) {
          selectedProvider = this.sanBernardinoCountyProvider;
        } else if (query.preferredProvider === 'ventura_county_gis' || isVenturaCounty) {
          selectedProvider = this.venturaCountyProvider;
        } else if (query.preferredProvider === 'santa_clara_county_gis' || isSantaClaraCounty) {
          selectedProvider = this.santaClaraCountyProvider;
        } else if (query.preferredProvider === 'alameda_county_gis' || isAlamedaCounty) {
          selectedProvider = this.alamedaCountyProvider;
        } else if (query.preferredProvider === 'sacramento_county_gis' || isSacramentoCounty) {
          selectedProvider = this.sacramentoCountyProvider;
        } else if (query.preferredProvider === 'los_angeles_county_gis' || isLosAngelesCounty) {
          selectedProvider = this.losAngelesCountyProvider;
        } else if (query.preferredProvider === 'california_gis' || query.preferredProvider === 'orange_county_gis' || isOrangeCounty) {
          selectedProvider = this.orangeCountyProvider;
        } else {
          // Default to statewide cadastral GIS
          selectedProvider = this.orangeCountyProvider;
        }

        providerNameUsed = selectedProvider.providerName;
        let results: NormalizedPropertyResult[] = [];

        try {
          results = await selectedProvider.search(query);
        } catch (err: any) {
          warnings.push(`Primary provider [${selectedProvider.providerName}] encountered error: ${err.message}`);
        }

        // Automatic fallback to Statewide Open GIS provider if no results or error
        if (results.length === 0 && selectedProvider !== this.orangeCountyProvider && !query.preferredProvider) {
          try {
            console.log('[PropertyDataProvider] Primary returned 0 results or failed. Falling back to California Statewide Cadastral GIS provider...');
            results = await this.orangeCountyProvider.search(query);
            if (results.length > 0) {
              providerNameUsed = `${this.orangeCountyProvider.providerName} (Statewide Cadastral)`;
            }
          } catch (fallbackErr: any) {
            warnings.push(`Fallback provider failed: ${fallbackErr.message}`);
          }
        }

        // Commercial & Open Search Provider Fallback Pipeline (Zillow, Realtor, Redfin, ATTOM, NETR Online, ZoomInfo, ArcGIS, Google Maps)
        if (results.length === 0) {
          const providerPipeline: { name: string; key?: string; isOpenSearch?: boolean; provider: IPropertyDataProvider }[] = [
            { name: 'Zillow (Open Search)', isOpenSearch: true, provider: this.zillowProvider },
            { name: 'Realtor.com (Open Search)', isOpenSearch: true, provider: this.realtorProvider },
            { name: 'Redfin (Open Search)', isOpenSearch: true, provider: this.redfinProvider },
            { name: 'ATTOM Data', key: process.env.ATTOM_API_KEY, provider: this.attomProvider },
            { name: 'NETR Online', key: process.env.NETR_ONLINE_API_KEY, provider: this.netrOnlineProvider },
            { name: 'ZoomInfo', key: process.env.ZOOMINFO_API_KEY, provider: this.zoomInfoProvider },
            { name: 'ArcGIS Server', key: process.env.ARCGIS_API_KEY, provider: this.arcGISServerProvider },
            { name: 'Google Maps', key: process.env.GOOGLE_MAPS_API_KEY, provider: this.googleMapsProvider },
          ];

          for (const item of providerPipeline) {
            if (results.length > 0) break;
            if (item.isOpenSearch || item.key) {
              try {
                console.log(`[PropertyDataProvider] Secondary fallback attempting ${item.name}...`);
                const fbResults = await item.provider.search(query);
                if (fbResults.length > 0) {
                  results = fbResults;
                  providerNameUsed = `${item.provider.providerName} (Open/Commercial Fallback)`;
                }
              } catch (apiErr: any) {
                warnings.push(`Provider [${item.name}] fallback failed: ${apiErr.message}`);
              }
            }
          }
        }

        // Provider failures produce no synthetic or in-memory substitute records.

        // Middleware Validation & Data Quality Enforcement Step
        const validatedResults: NormalizedPropertyResult[] = [];
        for (const item of results) {
          const val = validateAndClassifyResult(item);
          if (!val.isValid || val.quality === 'red') {
            console.warn(`[PropertyDataProvider] Middleware Validation: Rejecting incomplete/invalid record APN ${item.property.apn}:`, val.issues);
            warnings.push(`Rejected incomplete record APN ${item.property.apn}: ${val.issues.join(', ')}`);
            continue;
          }
          item.property.data_quality = val.quality;
          item.property.data_quality_notes = val.issues.join('; ') || 'Passed full skip-trace verification';
          validatedResults.push(item);
        }
        results = validatedResults;

        // Always inject latitude and longitude to property if available
        for (const item of results) {
          if (item.geometry?.centroid) {
            item.property.latitude = item.geometry.centroid.lat;
            item.property.longitude = item.geometry.centroid.lon;
          }
        }

        // Apply advanced query filters
        results = results.filter((item) => {
          const p = item.property;
          const o = item.owner;
          if (query.minPrice && (p.estimated_value || 0) < query.minPrice) return false;
          if (query.maxPrice && (p.estimated_value || 0) > query.maxPrice) return false;
          if (query.taxDelinquentOnly && !p.tax_delinquent) return false;
          if (query.minSquareFeet && (p.square_feet || 0) < query.minSquareFeet) return false;
          if (query.entityType && query.entityType !== 'All') {
            const ent = (o?.entity_type || '').toLowerCase();
            if (query.entityType === 'llc' && !ent.includes('llc') && !ent.includes('corp')) return false;
            if (query.entityType === 'individual' && !ent.includes('indiv')) return false;
            if (query.entityType === 'trust' && !ent.includes('trust')) return false;
          }
          return true;
        });

        if (query.limit && results.length > query.limit) {
          results = results.slice(0, query.limit);
        }

        // Persist records if requested (default to true)
        let persistedCount = 0;
        let newlyDiscovered: NormalizedPropertyResult[] = [];
        const shouldPersist = query.persist !== false;

        if (shouldPersist && results.length > 0) {
          const persisted = await this.persistResults(results, requireOrganizationId(query.organizationId));
          persistedCount = persisted.savedCount;
          newlyDiscovered = persisted.newlyDiscovered;
        }

        const duration = Date.now() - startTime;

        return {
          success: results.length > 0 || warnings.length === 0,
          query,
          providerUsed: providerNameUsed,
          totalFound: results.length,
          results,
          persistedCount,
          newlyDiscovered,
          warnings: warnings.length > 0 ? warnings : undefined,
          executionTimeMs: duration,
        };
      }
    );

    if (!isCached && result.newlyDiscovered?.length > 0) {
      const orgId = requireOrganizationId(query.organizationId);
      void Promise.all(result.newlyDiscovered.map((item) =>
        externalWebhookService.publish(
          orgId,
          'property.discovered',
          buildPropertyDiscoveredPayload(item.property, item.owner),
        )
      )).catch((error) => {
        console.error('[ExternalWebhook] property.discovered delivery error:', error);
      });
    }

    if (isCached && result) {
      if (query.persist !== false && result.results?.length > 0) {
        const orgId = requireOrganizationId(query.organizationId);
        const persisted = await this.persistResults(result.results, orgId);
        return {
          ...result,
          persistedCount: persisted.savedCount,
          providerUsed: `${result.providerUsed} (Cached)`,
        };
      }
      return {
        ...result,
        providerUsed: `${result.providerUsed} (Cached)`,
      };
    }

    return result;
  }

  /**
   * Persists property search results into PostgreSQL Cloud SQL and In-Memory Store
   */
  private async persistResults(results: NormalizedPropertyResult[], orgId: string): Promise<{
    savedCount: number;
    newlyDiscovered: NormalizedPropertyResult[];
  }> {
    let savedCount = 0;
    const newlyDiscovered: NormalizedPropertyResult[] = [];
    const pool = getPgPool();

    for (const item of results) {
      const { property, owner, geometry } = item;
      let isNewProperty = !inMemoryStore.properties.some(
        (p) => p.organization_id === orgId && (p.apn === property.apn || p.address === property.address)
      );

      if (pool && isNewProperty) {
        try {
          const existing = await pool.query(
            `SELECT 1 FROM properties WHERE organization_id = $1 AND (apn = $2 OR address = $3) LIMIT 1`,
            [orgId, property.apn, property.address]
          );
          isNewProperty = existing.rowCount === 0;
        } catch (dbErr: any) {
          console.warn('[PropertyDataProvider] Could not verify property novelty:', dbErr.message);
          isNewProperty = false;
        }
      }
      
      if (geometry?.centroid) {
        property.latitude = geometry.centroid.lat;
        property.longitude = geometry.centroid.lon;
      }

      // 1. Sync In-Memory Store
      const existingPropIndex = inMemoryStore.properties.findIndex(
        (p) => p.organization_id === orgId && (p.apn === property.apn || p.address === property.address)
      );

      if (existingPropIndex >= 0) {
        inMemoryStore.properties[existingPropIndex] = property;
      } else {
        inMemoryStore.properties.unshift(property);
      }

      if (owner) {
        const existingOwnerIndex = inMemoryStore.propertyOwners.findIndex(
          (o) => o.organization_id === orgId && o.id === owner.id
        );
        if (existingOwnerIndex >= 0) {
          inMemoryStore.propertyOwners[existingOwnerIndex] = owner;
        } else {
          inMemoryStore.propertyOwners.unshift(owner);
        }
      }

      // 2. Persist to PostgreSQL if connected
      if (pool) {
        try {
          // Ensure organization exists to satisfy foreign key constraints
          await pool.query(
            `INSERT INTO organizations (id, name, slug, settings, created_at, updated_at)
             VALUES ($1, $2, $3, '{}'::jsonb, NOW(), NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              orgId,
              orgId === 'org_cmc_realty' ? 'CMC Realty & Property Management' : orgId.replace(/[-_]/g, ' '),
              orgId.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'default-org',
            ]
          );

          if (owner) {
            await pool.query(
              `INSERT INTO property_owners (
                id, organization_id, name, entity_type, mailing_address, mailing_city,
                mailing_state, mailing_zip, phone_numbers, email_addresses,
                properties_owned_count, total_portfolio_value, total_portfolio_equity, notes, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                mailing_address = EXCLUDED.mailing_address,
                updated_at = NOW()`,
              [
                owner.id,
                orgId,
                owner.name,
                owner.entity_type || 'individual',
                owner.mailing_address,
                owner.mailing_city,
                owner.mailing_state,
                owner.mailing_zip,
                JSON.stringify(owner.phone_numbers || []),
                JSON.stringify(owner.email_addresses || []),
                owner.properties_owned_count || 1,
                owner.total_portfolio_value || 0,
                owner.total_portfolio_equity || 0,
                owner.notes || null,
              ]
            );
          }

          await pool.query(
            `INSERT INTO properties (
              id, organization_id, owner_id, address, city, state, zip, county,
              apn, property_type, units_count, square_feet, year_built,
              estimated_value, assessed_tax_value, estimated_equity, mortgage_balance,
              is_absentee_owner, is_corporate_owned, tax_delinquent, provenance, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
            ON CONFLICT (organization_id, apn) DO UPDATE SET
              address = EXCLUDED.address,
              city = EXCLUDED.city,
              zip = EXCLUDED.zip,
              estimated_value = EXCLUDED.estimated_value,
              assessed_tax_value = EXCLUDED.assessed_tax_value,
              provenance = EXCLUDED.provenance`,
            [
              property.id,
              orgId,
              owner ? owner.id : null,
              property.address,
              property.city,
              property.state,
              property.zip,
              property.county,
              property.apn,
              property.property_type,
              property.units_count,
              property.square_feet,
              property.year_built,
              property.estimated_value,
              property.assessed_tax_value,
              property.estimated_equity,
              property.mortgage_balance,
              property.is_absentee_owner,
              property.is_corporate_owned,
              property.tax_delinquent,
              JSON.stringify(property.provenance),
            ]
          );
        } catch (dbErr: any) {
          console.error('[PropertyDataProvider] PostgreSQL persistence error:', dbErr.message);
        }
      }

      savedCount++;
      if (isNewProperty) newlyDiscovered.push(item);
    }

    // 3. Create Audit Trail Entry
    const auditEntry: AuditLogEntry = {
      id: `audit_prop_search_${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: 'agent_1',
      action: 'property_search_live_query',
      input: { resultsCount: results.length, orgId },
      output: { persistedCount: savedCount, topResult: results[0]?.property?.address },
      status: 'success',
      latency_ms: 25,
      organization_id: orgId,
      source: results[0]?.provenance?.provider || 'County GIS API',
    };
    inMemoryStore.auditLogs.unshift(auditEntry);

    return { savedCount, newlyDiscovered };
  }
}

function validateAndClassifyResult(item: NormalizedPropertyResult): { isValid: boolean; quality: 'green' | 'yellow' | 'red'; issues: string[] } {
  const issues: string[] = [];
  const p = item.property;
  const o = item.owner;

  if (!p || !p.apn || !p.address) {
    issues.push('Missing APN or physical address');
  }

  if (!o || !o.name || o.name.includes('Protected') || o.name.includes('Placeholder') || o.name.toLowerCase().includes('unknown')) {
    issues.push('Missing or statutorily redacted owner name');
  }

  const hasPhones = o?.phone_numbers && o.phone_numbers.length > 0 && o.phone_numbers.some(ph => ph.number && ph.number.length > 5);
  const hasEmails = o?.email_addresses && o.email_addresses.length > 0 && o.email_addresses.some(em => em.email && em.email.includes('@'));

  if (!hasPhones && !hasEmails) {
    issues.push('Missing valid contact details (phones/emails)');
  }

  let quality: 'green' | 'yellow' | 'red' = 'green';
  if (issues.length > 0) {
    if (issues.some(i => i.includes('APN') || i.includes('owner name'))) {
      quality = 'red';
    } else {
      quality = 'yellow';
    }
  }

  const isValid = !issues.some(i => i.includes('APN') || i.includes('owner name'));
  return { isValid, quality, issues };
}
