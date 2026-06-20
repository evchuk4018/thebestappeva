import { useCallback, useEffect, useState } from 'react';
import type { AutomationRecord, AutomationSummary, CreateAutomationRequest, UpdateAutomationRequest } from '../../../../shared/automations-contract';
import {
  createAutomation,
  deleteAutomation,
  fetchAutomations,
  toggleAutomation,
  updateAutomation,
} from './automations-api';

export interface UseAutomationsResult {
  automations: AutomationSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (request: CreateAutomationRequest) => Promise<AutomationRecord>;
  update: (id: string, request: UpdateAutomationRequest) => Promise<AutomationRecord>;
  toggle: (id: string, enabled: boolean) => Promise<AutomationRecord>;
  remove: (id: string) => Promise<void>;
  updateRunState: (automation: AutomationRecord) => void;
}

function sortAutomations(automations: AutomationSummary[]) {
  return [...automations].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.name.localeCompare(right.name));
}

export function useAutomations(): UseAutomationsResult {
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setAutomations(sortAutomations(await fetchAutomations()));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load automations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateRunState = useCallback((automation: AutomationRecord) => {
    setAutomations((current) => sortAutomations(current.some((entry) => entry.id === automation.id)
      ? current.map((entry) => entry.id === automation.id ? automation : entry)
      : [...current, automation]));
  }, []);

  const create = useCallback(async (request: CreateAutomationRequest) => {
    const automation = await createAutomation(request);
    updateRunState(automation);
    return automation;
  }, [updateRunState]);

  const update = useCallback(async (id: string, request: UpdateAutomationRequest) => {
    const automation = await updateAutomation(id, request);
    updateRunState(automation);
    return automation;
  }, [updateRunState]);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    const automation = await toggleAutomation(id, enabled);
    updateRunState(automation);
    return automation;
  }, [updateRunState]);

  const remove = useCallback(async (id: string) => {
    await deleteAutomation(id);
    setAutomations((current) => current.filter((entry) => entry.id !== id));
  }, []);
  return { automations, loading, error, refresh, create, update, toggle, remove, updateRunState };
}
