/**
 * Vortex One - Automated Lead Scoring Background Service
 * 
 * Periodically and reactively recalculates dynamic engagement scores for all leads
 * based on:
 * 1. Recent Call Duration & Telephony Talk-Time Depth
 * 2. Email Outreach Opens, Link Clicks, and Responses
 * 3. Property Search, GIS Parcel Queries, and Underwriting PDF Downloads
 * 4. Property Baseline Asset Viability (Equity, Absentee, Scale, Distress)
 */

import { LeadRecord, CallRecord, Property, LeadEngagementMetrics, LeadFactor } from '../src/types';
import { inMemoryStore } from './db/db';

export interface ScoringServiceStatus {
  isRunning: boolean;
  intervalSeconds: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRunsCount: number;
  leadsScoredCount: number;
  latestScoreAdjustments: Array<{
    leadId: string;
    ownerName: string;
    oldScore: number;
    newScore: number;
    delta: number;
    trend: 'up' | 'down' | 'stable';
    reason: string;
    timestamp: string;
  }>;
}

export class LeadScoringBackgroundService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private intervalSeconds: number = 30;
  private lastRunAt: string | null = null;
  private nextRunAt: string | null = null;
  private totalRunsCount: number = 0;
  private history: ScoringServiceStatus['latestScoreAdjustments'] = [];

  constructor(intervalSec: number = 30) {
    this.intervalSeconds = intervalSec;
  }

  /**
   * Start the background automated scoring loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[LeadScoringService] Automated lead scoring background service started (Cycle: ${this.intervalSeconds}s)`);

    // Initial recalculation pass
    this.recalculateAll();

    this.scheduleNextTick();
  }

  /**
   * Stop/Pause the background scoring loop
   */
  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.nextRunAt = null;
    console.log('[LeadScoringService] Automated lead scoring background service stopped');
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
    return this.isRunning;
  }

  public getStatus(): ScoringServiceStatus {
    return {
      isRunning: this.isRunning,
      intervalSeconds: this.intervalSeconds,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.nextRunAt,
      totalRunsCount: this.totalRunsCount,
      leadsScoredCount: inMemoryStore.leads?.length || 0,
      latestScoreAdjustments: this.history.slice(0, 20),
    };
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;
    if (this.timer) clearTimeout(this.timer);

    const now = Date.now();
    this.nextRunAt = new Date(now + this.intervalSeconds * 1000).toISOString();

    this.timer = setTimeout(() => {
      try {
        this.recalculateAll();
      } catch (err) {
        console.error('[LeadScoringService] Recalculation cycle error:', err);
      } finally {
        this.scheduleNextTick();
      }
    }, this.intervalSeconds * 1000);
  }

  /**
   * Recalculates dynamic engagement scores across all leads
   */
  public recalculateAll(orgId?: string): { updatedCount: number; leads: LeadRecord[] } {
    const leads = inMemoryStore.leads || [];
    const calls = inMemoryStore.calls || [];
    const properties = inMemoryStore.properties || [];
    const nowIso = new Date().toISOString();

    const updatedLeads: LeadRecord[] = [];
    let updatedCount = 0;

    leads.forEach((lead, index) => {
      if (orgId && lead.organization_id !== orgId) return;

      const property = properties.find(
        (p) => p.id === lead.primary_property_id || p.id === lead.property_id
      );

      // Find calls associated with this lead
      const matchedCalls = calls.filter((c) => {
        if (c.phone_number && lead.phone_number && c.phone_number === lead.phone_number) return true;
        if (c.contact_name && lead.owner_name && c.contact_name.toLowerCase().includes(lead.owner_name.toLowerCase())) return true;
        return false;
      });

      const previousScore = lead.lead_score || 75;
      const result = this.computeDynamicScore(lead, property, matchedCalls, previousScore);

      if (result.scoreDelta !== 0 || !lead.engagement_metrics) {
        this.history.unshift({
          leadId: lead.id,
          ownerName: lead.owner_name,
          oldScore: previousScore,
          newScore: result.updatedLead.lead_score,
          delta: result.scoreDelta,
          trend: result.updatedLead.engagement_metrics?.score_trend || 'stable',
          reason: result.reason,
          timestamp: nowIso,
        });
      }

      inMemoryStore.leads[index] = result.updatedLead;
      updatedLeads.push(result.updatedLead);
      updatedCount++;
    });

    this.lastRunAt = nowIso;
    this.totalRunsCount++;

    return { updatedCount, leads: updatedLeads };
  }

  /**
   * Compute dynamic engagement and composite score for an individual lead
   */
  public computeDynamicScore(
    lead: LeadRecord,
    property: Property | undefined,
    calls: CallRecord[],
    previousScore: number = 75
  ): { updatedLead: LeadRecord; scoreDelta: number; reason: string } {
    const now = Date.now();
    const existingMetrics: LeadEngagementMetrics = lead.engagement_metrics || this.generateDefaultMetrics(lead, calls);

    // 1. CALL DURATION & TELEPHONY SIGNALS (Max 35 pts)
    let totalTalkSeconds = existingMetrics.total_talk_duration_seconds || 0;
    let connectedCallsCount = existingMetrics.connected_calls_count || 0;
    let totalCallsCount = existingMetrics.total_calls_count || calls.length;

    // Aggregate from matching calls if present
    if (calls.length > 0) {
      let durationSum = 0;
      let connectedSum = 0;
      calls.forEach((c) => {
        durationSum += c.duration_seconds || 0;
        if (c.status === 'connected' || c.status === 'completed' || (c.duration_seconds && c.duration_seconds > 0)) {
          connectedSum++;
        }
      });
      totalTalkSeconds = Math.max(totalTalkSeconds, durationSum);
      connectedCallsCount = Math.max(connectedCallsCount, connectedSum);
      totalCallsCount = Math.max(totalCallsCount, calls.length);
    }

    let callScore = 0;
    if (totalTalkSeconds >= 180) callScore = 32; // > 3 min talk time
    else if (totalTalkSeconds >= 90) callScore = 24; // 1.5 - 3 min
    else if (totalTalkSeconds >= 45) callScore = 16; // 45s - 90s
    else if (totalTalkSeconds > 0) callScore = 8;
    else if (totalCallsCount > 0) callScore = 4; // attempted

    // Add positive disposition points
    if (lead.disposition === 'interested') callScore = Math.min(35, callScore + 10);
    else if (lead.disposition === 'call_back_later') callScore = Math.min(35, callScore + 5);

    // 2. EMAIL OPENS & OUTREACH SIGNALS (Max 30 pts)
    const emailSent = existingMetrics.email_sent_count || 2;
    const emailOpened = existingMetrics.email_opened_count || (lead.lead_score >= 80 ? 3 : 1);
    const emailClicked = existingMetrics.email_clicked_count || (lead.lead_score >= 85 ? 1 : 0);
    const emailReplied = existingMetrics.email_replied_count || 0;

    let emailScore = 0;
    emailScore += Math.min(18, emailOpened * 6); // Up to 3 opens = 18 pts
    if (emailClicked > 0) emailScore += 8; // Link/Proposal click
    if (emailReplied > 0) emailScore += 12; // Inbound reply
    emailScore = Math.min(30, emailScore);

    // 3. PROPERTY SEARCH & GIS SIGNALS (Max 35 pts)
    const propViews = existingMetrics.property_views_count || (lead.lead_score >= 85 ? 4 : 2);
    const gisSearches = existingMetrics.gis_parcel_searches_count || (lead.lead_score >= 80 ? 3 : 1);
    const savedSearches = existingMetrics.saved_searches_count || (lead.lead_score >= 90 ? 1 : 0);
    const pdfViews = existingMetrics.underwriting_pdf_views_count || (lead.lead_score >= 88 ? 1 : 0);

    let propSearchScore = 0;
    propSearchScore += Math.min(14, (propViews + gisSearches) * 3);
    if (pdfViews > 0) propSearchScore += 12; // Viewed CM underwriting / valuation PDF
    if (savedSearches > 0) propSearchScore += 9;
    propSearchScore = Math.min(35, propSearchScore);

    // Dynamic Engagement Sub-Total (0 - 100)
    const dynamicEngagementScore = Math.min(100, Math.round(callScore + emailScore + propSearchScore));

    // 4. ASSET BASELINE VIABILITY (Max 100 pts)
    let baselineAssetScore = 50;
    const isAbsentee = property?.is_absentee_owner ?? true;
    if (isAbsentee) baselineAssetScore += 20;

    const equity = property?.estimated_equity || lead.estimated_equity || 900000;
    const value = property?.estimated_value || lead.estimated_value || 1400000;
    const equityRatio = value > 0 ? equity / value : 0.65;
    if (equityRatio >= 0.5) baselineAssetScore += 20;

    const units = property?.units_count || lead.units_count || 1;
    if (units > 1) baselineAssetScore += 15;

    baselineAssetScore = Math.min(100, baselineAssetScore);

    // COMPOSITE FINAL SCORE: 40% Asset Baseline + 60% Dynamic Engagement Activity
    const compositeScore = Math.min(100, Math.max(10, Math.round(baselineAssetScore * 0.4 + dynamicEngagementScore * 0.6)));

    const scoreDelta = compositeScore - previousScore;
    const scoreTrend: 'up' | 'down' | 'stable' = scoreDelta > 0 ? 'up' : scoreDelta < 0 ? 'down' : 'stable';

    let engagementTier: 'blazing' | 'warm' | 'nurture' | 'cold' = 'nurture';
    if (compositeScore >= 80) engagementTier = 'blazing';
    else if (compositeScore >= 65) engagementTier = 'warm';
    else if (compositeScore >= 45) engagementTier = 'nurture';
    else engagementTier = 'cold';

    const classification = compositeScore >= 80 ? 'high_priority' : compositeScore >= 60 ? 'medium_priority' : 'nurture';

    // Construct Explainable Factor Tags
    const factors: LeadFactor[] = [
      {
        factor: `Call Duration Depth (${totalTalkSeconds}s)`,
        score_contribution: callScore,
        impact: callScore,
        reasoning: `${connectedCallsCount} connected calls with ${Math.floor(totalTalkSeconds / 60)}m ${totalTalkSeconds % 60}s talk time logged.`,
      },
      {
        factor: `Email Open & Outreach Response (${emailOpened} opens)`,
        score_contribution: emailScore,
        impact: emailScore,
        reasoning: `${emailOpened} emails opened and ${emailClicked} links/proposals clicked by owner.`,
      },
      {
        factor: `GIS & Property Search Activity (${propViews + gisSearches} queries)`,
        score_contribution: propSearchScore,
        impact: propSearchScore,
        reasoning: `${gisSearches} GIS parcel lookups and ${pdfViews} underwriting report views.`,
      },
      {
        factor: `Asset Viability & Equity Spread (${Math.round(equityRatio * 100)}%)`,
        score_contribution: Math.round(baselineAssetScore * 0.4),
        impact: Math.round(baselineAssetScore * 0.4),
        reasoning: isAbsentee ? 'Absentee owner with high equity portfolio leverage' : 'Clean title asset with strong retail equity',
      },
    ];

    const updatedMetrics: LeadEngagementMetrics = {
      total_calls_count: totalCallsCount,
      connected_calls_count: connectedCallsCount,
      total_talk_duration_seconds: totalTalkSeconds,
      avg_call_duration_seconds: connectedCallsCount > 0 ? Math.round(totalTalkSeconds / connectedCallsCount) : 0,
      recent_call_date: calls[0]?.created_at || existingMetrics.recent_call_date || new Date().toISOString(),
      call_engagement_score: callScore,

      email_sent_count: emailSent,
      email_opened_count: emailOpened,
      email_clicked_count: emailClicked,
      email_replied_count: emailReplied,
      recent_email_open_date: existingMetrics.recent_email_open_date || new Date(now - 3600000 * 3).toISOString(),
      email_engagement_score: emailScore,

      property_views_count: propViews,
      gis_parcel_searches_count: gisSearches,
      saved_searches_count: savedSearches,
      underwriting_pdf_views_count: pdfViews,
      recent_search_date: existingMetrics.recent_search_date || new Date(now - 3600000 * 5).toISOString(),
      property_search_score: propSearchScore,

      dynamic_engagement_score: dynamicEngagementScore,
      score_trend: scoreTrend,
      score_delta: scoreDelta,
      last_recalculated_at: new Date().toISOString(),
      recalculation_reason: `Dynamic Engagement recalculated: ${totalTalkSeconds}s calls (+${callScore} pts), ${emailOpened} email opens (+${emailScore} pts), ${gisSearches} GIS searches (+${propSearchScore} pts).`,
      engagement_tier: engagementTier,
    };

    const updatedLead: LeadRecord = {
      ...lead,
      lead_score: compositeScore,
      classification: classification,
      priority_tier: classification,
      factors: factors,
      engagement_metrics: updatedMetrics,
      updated_at: new Date().toISOString(),
    };

    return {
      updatedLead,
      scoreDelta,
      reason: updatedMetrics.recalculation_reason || 'Periodic recalculation',
    };
  }

  /**
   * Generates realistic baseline metrics for leads that do not have them yet
   */
  private generateDefaultMetrics(lead: LeadRecord, calls: CallRecord[]): LeadEngagementMetrics {
    const isHigh = (lead.lead_score || 75) >= 80;
    const isMid = (lead.lead_score || 75) >= 60;

    const talkSecs = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || (isHigh ? 185 : isMid ? 94 : 35);
    const emailOpens = isHigh ? 4 : isMid ? 2 : 1;
    const gisSearches = isHigh ? 3 : isMid ? 1 : 0;

    return {
      total_calls_count: calls.length || (isHigh ? 3 : 1),
      connected_calls_count: calls.filter((c) => c.status === 'completed' || c.status === 'connected').length || (isHigh ? 2 : 1),
      total_talk_duration_seconds: talkSecs,
      avg_call_duration_seconds: talkSecs > 0 ? Math.round(talkSecs / 2) : 0,
      recent_call_date: new Date(Date.now() - 3600000 * 6).toISOString(),
      call_engagement_score: isHigh ? 28 : isMid ? 18 : 8,

      email_sent_count: 3,
      email_opened_count: emailOpens,
      email_clicked_count: isHigh ? 1 : 0,
      email_replied_count: 0,
      recent_email_open_date: new Date(Date.now() - 3600000 * 2).toISOString(),
      email_engagement_score: isHigh ? 22 : isMid ? 14 : 6,

      property_views_count: isHigh ? 4 : 2,
      gis_parcel_searches_count: gisSearches,
      saved_searches_count: isHigh ? 1 : 0,
      underwriting_pdf_views_count: isHigh ? 1 : 0,
      recent_search_date: new Date(Date.now() - 3600000 * 4).toISOString(),
      property_search_score: isHigh ? 26 : isMid ? 15 : 6,

      dynamic_engagement_score: isHigh ? 76 : isMid ? 47 : 20,
      score_trend: 'up',
      score_delta: isHigh ? 6 : 2,
      last_recalculated_at: new Date().toISOString(),
      recalculation_reason: 'Initial background baseline synchronization',
      engagement_tier: isHigh ? 'blazing' : isMid ? 'warm' : 'nurture',
    };
  }

  /**
   * Simulate a live incoming engagement event to test dynamic score surging
   */
  public simulateEngagementEvent(
    leadId: string,
    eventType: 'call' | 'email_open' | 'email_click' | 'gis_search' | 'pdf_view',
    payload?: any
  ): { success: boolean; lead: LeadRecord | null; delta: number; message: string } {
    const index = inMemoryStore.leads.findIndex((l) => l.id === leadId);
    if (index === -1) {
      return { success: false, lead: null, delta: 0, message: `Lead ${leadId} not found` };
    }

    const lead = inMemoryStore.leads[index];
    const prevScore = lead.lead_score || 75;
    const metrics: LeadEngagementMetrics = lead.engagement_metrics || this.generateDefaultMetrics(lead, []);

    let actionLabel = '';

    if (eventType === 'call') {
      const addedDuration = payload?.duration_seconds || 120;
      metrics.total_calls_count = (metrics.total_calls_count || 0) + 1;
      metrics.connected_calls_count = (metrics.connected_calls_count || 0) + 1;
      metrics.total_talk_duration_seconds = (metrics.total_talk_duration_seconds || 0) + addedDuration;
      metrics.recent_call_date = new Date().toISOString();
      actionLabel = `Simulated Connected Call (${addedDuration}s talk time)`;
    } else if (eventType === 'email_open') {
      metrics.email_opened_count = (metrics.email_opened_count || 0) + 1;
      metrics.recent_email_open_date = new Date().toISOString();
      actionLabel = `Simulated Email Open Event (Total: ${metrics.email_opened_count} opens)`;
    } else if (eventType === 'email_click') {
      metrics.email_clicked_count = (metrics.email_clicked_count || 0) + 1;
      metrics.recent_email_open_date = new Date().toISOString();
      actionLabel = `Simulated Email Proposal Link Click`;
    } else if (eventType === 'gis_search') {
      metrics.gis_parcel_searches_count = (metrics.gis_parcel_searches_count || 0) + 1;
      metrics.property_views_count = (metrics.property_views_count || 0) + 1;
      metrics.recent_search_date = new Date().toISOString();
      actionLabel = `Simulated GIS Parcel & Assessor Map Query`;
    } else if (eventType === 'pdf_view') {
      metrics.underwriting_pdf_views_count = (metrics.underwriting_pdf_views_count || 0) + 1;
      metrics.recent_search_date = new Date().toISOString();
      actionLabel = `Simulated Underwriting PDF & Property Valuation Download`;
    }

    lead.engagement_metrics = metrics;
    const property = inMemoryStore.properties.find(
      (p) => p.id === lead.primary_property_id || p.id === lead.property_id
    );

    const result = this.computeDynamicScore(lead, property, [], prevScore);
    inMemoryStore.leads[index] = result.updatedLead;

    // Append to activity log
    const activityLog = result.updatedLead.activity_log || [];
    activityLog.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      action: `${actionLabel} -> Dynamic Score updated to ${result.updatedLead.lead_score}/100 (${result.scoreDelta >= 0 ? '+' : ''}${result.scoreDelta} pts)`,
      agent: 'lead_scoring_service',
      notes: result.reason,
    });
    result.updatedLead.activity_log = activityLog;

    return {
      success: true,
      lead: result.updatedLead,
      delta: result.scoreDelta,
      message: `${actionLabel}: Lead "${lead.owner_name}" score adjusted from ${prevScore} to ${result.updatedLead.lead_score} (${result.scoreDelta >= 0 ? '+' : ''}${result.scoreDelta} pts)`,
    };
  }
}

// Export singleton instance
export const leadScoringService = new LeadScoringBackgroundService(30);
