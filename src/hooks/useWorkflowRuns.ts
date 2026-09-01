import useSWR, { mutate as globalMutate, SWRConfiguration } from 'swr';
import { useCallback, useEffect, useRef } from 'react';
import { WorkflowRun, Task, WorkflowStep } from '../types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error ${res.status} fetching ${url}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return [];
  }
  const text = await res.text();
  if (!text || !text.trim()) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
};

export interface UseWorkflowRunsOptions {
  workflowId?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'paused_approval';
  limit?: number;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
  enabled?: boolean;
}

/**
 * Robust SWR polling hook to synchronize workflow runs from '/api/runs'.
 * Replaces WebSockets with resilient HTTP polling to eliminate connection drops and console errors.
 */
export function useWorkflowRuns(options: UseWorkflowRunsOptions = {}) {
  const {
    workflowId,
    status,
    limit = 20,
    refreshInterval = 2500,
    revalidateOnFocus = true,
    enabled = true,
  } = options;

  const queryParams = new URLSearchParams();
  if (workflowId) queryParams.set('workflow_id', workflowId);
  if (status) queryParams.set('status', status);
  if (limit) queryParams.set('limit', String(limit));

  const queryString = queryParams.toString();
  const endpoint = `/api/runs${queryString ? `?${queryString}` : ''}`;

  const swrConfig: SWRConfiguration = {
    refreshInterval: (latestData: WorkflowRun[] | undefined) => {
      if (!enabled) return 0;
      // If there is an active running DAG, poll faster (1000ms), otherwise standard interval (2500ms)
      const hasActive = Array.isArray(latestData) && latestData.some(
        (r) => r.status === 'running' || r.status === 'paused_approval'
      );
      return hasActive ? 1000 : refreshInterval;
    },
    revalidateOnFocus,
    revalidateOnReconnect: true,
    dedupingInterval: 1000,
    errorRetryCount: 3,
    errorRetryInterval: 3000,
    shouldRetryOnError: true,
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR<WorkflowRun[]>(
    enabled ? endpoint : null,
    fetcher,
    swrConfig
  );

  const runs = Array.isArray(data) ? data : [];
  const activeRun = runs.find((r) => r.status === 'running' || r.status === 'paused_approval') || null;
  const latestRun = runs.length > 0 ? runs[0] : null;

  return {
    runs,
    activeRun,
    latestRun,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * SWR polling hook for a specific workflow run by ID from '/api/runs/:id'.
 */
export function useWorkflowRun(runId: string | null | undefined, options: { refreshInterval?: number; enabled?: boolean } = {}) {
  const { refreshInterval = 1500, enabled = true } = options;

  const swrConfig: SWRConfiguration = {
    refreshInterval: (latestData: WorkflowRun | undefined) => {
      if (!enabled || !runId) return 0;
      // Stop polling once the run finishes or fails
      if (latestData && (latestData.status === 'completed' || latestData.status === 'failed')) {
        return 0;
      }
      return refreshInterval;
    },
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 800,
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR<WorkflowRun>(
    enabled && runId ? `/api/runs/${runId}` : null,
    fetcher,
    swrConfig
  );

  return {
    run: data || null,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * SWR polling hook for real-time Agent tasks & telemetry.
 */
export function useAgentTelemetry(options: { refreshInterval?: number; enabled?: boolean } = {}) {
  const { refreshInterval = 2500, enabled = true } = options;

  const swrConfig: SWRConfiguration = {
    refreshInterval: enabled ? refreshInterval : 0,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1200,
  };

  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    enabled ? '/api/tasks' : null,
    fetcher,
    swrConfig
  );

  return {
    tasks: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * Trigger a workflow execution and immediately refresh the SWR cache.
 */
export async function executeWorkflowRun(params: {
  workflow_id?: string;
  steps: WorkflowStep[];
  custom_input?: any;
  organizationId?: string;
}) {
  const res = await fetch('/api/workflows/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Workflow execution failed with status ${res.status}`);
  }

  const result = await res.json();
  // Invalidate and revalidate all runs caches immediately
  globalMutate((key) => typeof key === 'string' && key.startsWith('/api/runs'));
  globalMutate('/api/tasks');

  return result;
}

/**
 * Abort an in-flight workflow run.
 */
export async function abortWorkflowRun(runId: string) {
  const res = await fetch(`/api/runs/${runId}/abort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to abort run ${runId}`);
  }

  const result = await res.json();
  globalMutate((key) => typeof key === 'string' && key.startsWith('/api/runs'));
  return result;
}
