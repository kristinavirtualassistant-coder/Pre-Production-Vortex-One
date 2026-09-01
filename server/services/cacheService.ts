/**
 * Vortex One - Task Cache & Saved Answers Service
 * High-performance, persistent caching engine for heavy operations:
 * - Gemini AI Orchestration & Reasoning Answers
 * - GIS & County Assessor Property Data Queries
 * - Skip Tracing & Owner Intelligence Deep Enrichment
 * - Voice Synthesis (TTS) Audio Generation
 * - Multi-Agent Workflow Runs
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface CacheOptions {
  ttlSeconds?: number;
  skipCache?: boolean;
  forceRefresh?: boolean;
  metadata?: Record<string, any>;
}

export interface CacheEntry<T = any> {
  key: string;
  category: string;
  inputDigest: string;
  data: T;
  cachedAt: string;
  expiresAt: string | null;
  hitCount: number;
  executionTimeSavedMs: number;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRatio: number;
  totalTimeSavedMs: number;
  entriesByCategory: Record<string, number>;
  memoryUsageBytes: number;
  lastClearedAt: string | null;
}

export class TaskCacheService {
  private cacheMap = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private totalTimeSavedMs = 0;
  private lastClearedAt: string | null = null;
  private persistFilePath: string;

  // Default TTLs per task category (in seconds)
  private defaultTTLs: Record<string, number> = {
    gemini_orchestrate: 24 * 3600,     // 24 hours
    gemini_text: 24 * 3600,            // 24 hours
    property_search: 12 * 3600,        // 12 hours
    skip_trace: 48 * 3600,             // 48 hours
    deep_enrich: 48 * 3600,            // 48 hours
    tts_audio: 7 * 24 * 3600,          // 7 days
    workflow_exec: 6 * 3600,           // 6 hours
    default: 12 * 3600,                // 12 hours default
  };

  constructor(persistFileName = 'cache_store.json') {
    this.persistFilePath = path.join(process.cwd(), 'server', 'data', persistFileName);
    this.ensureDataDir();
    this.loadFromDisk();

    // Periodically clean expired entries (every 5 minutes)
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.purgeExpired(), 5 * 60 * 1000);
    }
  }

  private ensureDataDir() {
    try {
      const dir = path.dirname(this.persistFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err: any) {
      console.warn('[TaskCacheService] Could not create data directory for cache persistence:', err?.message || err);
    }
  }

  /**
   * Generates a deterministic key for a category and input payload
   */
  public generateKey(category: string, inputPayload: any): { key: string; inputDigest: string } {
    let serializedPayload = '';
    if (typeof inputPayload === 'string') {
      serializedPayload = inputPayload.trim();
    } else if (inputPayload && typeof inputPayload === 'object') {
      const sortedKeys = Object.keys(inputPayload).sort();
      const sortedObj: Record<string, any> = {};
      for (const k of sortedKeys) {
        sortedObj[k] = inputPayload[k];
      }
      serializedPayload = JSON.stringify(sortedObj);
    } else {
      serializedPayload = String(inputPayload);
    }

    const hash = crypto.createHash('sha256').update(`${category}:${serializedPayload}`).digest('hex').slice(0, 32);
    const key = `${category}:${hash}`;

    // Create human-readable digest summary
    let digestStr = '';
    if (typeof inputPayload === 'string') {
      digestStr = inputPayload.slice(0, 80);
    } else if (inputPayload && typeof inputPayload === 'object') {
      digestStr = Object.entries(inputPayload)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : v}`)
        .join('; ')
        .slice(0, 100);
    }

    return { key, inputDigest: digestStr || 'Payload' };
  }

  /**
   * Get cached result for a heavy task
   */
  public get<T = any>(category: string, inputPayload: any, options: CacheOptions = {}): { data: T; entry: CacheEntry<T> } | null {
    if (options.skipCache || options.forceRefresh) {
      this.misses++;
      return null;
    }

    const { key } = this.generateKey(category, inputPayload);
    const entry = this.cacheMap.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
      this.cacheMap.delete(key);
      this.misses++;
      return null;
    }

    // Cache HIT!
    entry.hitCount++;
    this.hits++;
    this.totalTimeSavedMs += entry.executionTimeSavedMs || 500;

    return { data: entry.data as T, entry };
  }

  /**
   * Save result of a heavy task into cache
   */
  public set<T = any>(
    category: string,
    inputPayload: any,
    data: T,
    executionTimeMs: number = 0,
    options: CacheOptions = {}
  ): CacheEntry<T> {
    const { key, inputDigest } = this.generateKey(category, inputPayload);
    const ttlSeconds = options.ttlSeconds ?? (this.defaultTTLs[category] || this.defaultTTLs.default);

    const cachedAt = new Date().toISOString();
    const expiresAt = ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;

    const entry: CacheEntry<T> = {
      key,
      category,
      inputDigest,
      data,
      cachedAt,
      expiresAt,
      hitCount: 0,
      executionTimeSavedMs: Math.max(executionTimeMs, 100),
      metadata: options.metadata,
    };

    this.cacheMap.set(key, entry);
    this.saveToDiskDebounced();

    return entry;
  }

  /**
   * Execute heavy task with automatic cache check & store
   */
  public async wrapTask<T>(
    category: string,
    inputPayload: any,
    taskFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<{ result: T; isCached: boolean; executionTimeMs: number; cacheEntry?: CacheEntry<T> }> {
    // 1. Check cache
    const cached = this.get<T>(category, inputPayload, options);
    if (cached) {
      return {
        result: cached.data,
        isCached: true,
        executionTimeMs: 0,
        cacheEntry: cached.entry,
      };
    }

    // 2. Execute task and measure latency
    const start = Date.now();
    const result = await taskFn();
    const durationMs = Date.now() - start;

    // 3. Save to cache
    const cacheEntry = this.set<T>(category, inputPayload, result, durationMs, options);

    return {
      result,
      isCached: false,
      executionTimeMs: durationMs,
      cacheEntry,
    };
  }

  /**
   * Delete entry by key
   */
  public delete(key: string): boolean {
    const removed = this.cacheMap.delete(key);
    if (removed) this.saveToDiskDebounced();
    return removed;
  }

  /**
   * Clear cache (all or by category)
   */
  public clear(category?: string): number {
    if (!category) {
      const count = this.cacheMap.size;
      this.cacheMap.clear();
      this.lastClearedAt = new Date().toISOString();
      this.saveToDisk();
      return count;
    }

    let count = 0;
    for (const [key, entry] of this.cacheMap.entries()) {
      if (entry.category === category) {
        this.cacheMap.delete(key);
        count++;
      }
    }
    if (count > 0) this.saveToDisk();
    return count;
  }

  /**
   * Purge expired items
   */
  public purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.cacheMap.entries()) {
      if (entry.expiresAt && new Date(entry.expiresAt).getTime() < now) {
        this.cacheMap.delete(key);
        purged++;
      }
    }
    if (purged > 0) this.saveToDiskDebounced();
    return purged;
  }

  /**
   * Get stats summary
   */
  public getStats(): CacheStats {
    this.purgeExpired();
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? Number((this.hits / totalRequests).toFixed(4)) : 0;

    const entriesByCategory: Record<string, number> = {};
    for (const entry of this.cacheMap.values()) {
      entriesByCategory[entry.category] = (entriesByCategory[entry.category] || 0) + 1;
    }

    let memoryUsageBytes = 0;
    try {
      const jsonStr = JSON.stringify(Array.from(this.cacheMap.values()));
      memoryUsageBytes = Buffer.byteLength(jsonStr, 'utf8');
    } catch {
      memoryUsageBytes = this.cacheMap.size * 500;
    }

    return {
      totalEntries: this.cacheMap.size,
      totalHits: this.hits,
      totalMisses: this.misses,
      hitRatio,
      totalTimeSavedMs: this.totalTimeSavedMs,
      entriesByCategory,
      memoryUsageBytes,
      lastClearedAt: this.lastClearedAt,
    };
  }

  /**
   * Get list of cached entries
   */
  public getEntries(limit = 100, category?: string): CacheEntry[] {
    this.purgeExpired();
    let list = Array.from(this.cacheMap.values());
    if (category) {
      list = list.filter((e) => e.category === category);
    }
    list.sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime());
    return list.slice(0, limit);
  }

  // --- Persistence methods ---
  private saveTimeout: any = null;
  private saveToDiskDebounced() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveToDisk(), 1000);
  }

  private saveToDisk() {
    try {
      this.purgeExpired();
      const entries = Array.from(this.cacheMap.values());
      const payload = JSON.stringify({
        hits: this.hits,
        misses: this.misses,
        totalTimeSavedMs: this.totalTimeSavedMs,
        lastClearedAt: this.lastClearedAt,
        entries,
      }, null, 2);
      fs.writeFileSync(this.persistFilePath, payload, 'utf8');
    } catch (err: any) {
      console.warn('[TaskCacheService] Failed to persist cache to disk:', err?.message || err);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistFilePath)) {
        const raw = fs.readFileSync(this.persistFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.entries && Array.isArray(parsed.entries)) {
          const now = Date.now();
          for (const entry of parsed.entries) {
            if (!entry.expiresAt || new Date(entry.expiresAt).getTime() > now) {
              this.cacheMap.set(entry.key, entry);
            }
          }
        }
        if (typeof parsed.hits === 'number') this.hits = parsed.hits;
        if (typeof parsed.misses === 'number') this.misses = parsed.misses;
        if (typeof parsed.totalTimeSavedMs === 'number') this.totalTimeSavedMs = parsed.totalTimeSavedMs;
        if (parsed.lastClearedAt) this.lastClearedAt = parsed.lastClearedAt;
        console.log(`[TaskCacheService] Loaded ${this.cacheMap.size} valid cached entries from disk store.`);
      }
    } catch (err: any) {
      console.warn('[TaskCacheService] Error reading persistent cache from disk:', err?.message || err);
    }
  }
}

export const taskCacheService = new TaskCacheService();
