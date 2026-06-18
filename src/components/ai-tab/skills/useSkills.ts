import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSkill,
  deleteSkill,
  fetchSkills,
  toggleSkill,
  updateSkill,
} from './skills-api';
import { toSkillSummary, type CreateSkillRequest, type SkillRecord, type SkillSummary, type UpdateSkillRequest } from '../../../../shared/skills-contract';

export interface UseSkillsResult {
  skills: SkillSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (request: CreateSkillRequest) => Promise<SkillRecord>;
  update: (id: string, request: UpdateSkillRequest) => Promise<SkillRecord>;
  toggle: (id: string, enabled: boolean) => Promise<SkillRecord>;
  remove: (id: string) => Promise<void>;
}

export function useSkills(): UseSkillsResult {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const skillsRef = useRef<SkillSummary[]>([]);
  skillsRef.current = skills;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const next = await fetchSkills();
      setSkills(next);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load skills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (request: CreateSkillRequest) => {
    const skill = await createSkill(request);
    setSkills((current) => [...current, toSkillSummary(skill)]);
    return skill;
  }, []);

  const update = useCallback(async (id: string, request: UpdateSkillRequest) => {
    const skill = await updateSkill(id, request);
    setSkills((current) => current.map((entry) => (entry.id === id ? toSkillSummary(skill) : entry)));
    return skill;
  }, []);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    const skill = await toggleSkill(id, enabled);
    setSkills((current) => current.map((entry) => (entry.id === id ? { ...toSkillSummary(skill), enabled } : entry)));
    return skill;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteSkill(id);
    setSkills((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return { skills, loading, error, refresh, create, update, toggle, remove };
}