
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Group, Member } from '../types';
import { groupService } from '../services/groupService';
import { parseApiError } from '../services/authService';
import { useAuth } from './AuthContext';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface GroupContextType {
  groups: Group[];
  status: LoadStatus;
  addGroup: (group: Omit<Group, 'id' | 'createdAt'>) => Promise<void>;
  updateGroup: (id: string, data: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addMember: (member: Omit<Member, 'id'>) => Promise<void>;
  removeMember: (memberId: string, groupId: string) => Promise<void>;
  getGroupMembers: (groupId: string) => Member[];
  refetch: () => Promise<void>;
}

export const GroupContext = createContext<GroupContextType | null>(null);

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const { user, status: authStatus } = useAuth();

  const refetch = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await groupService.fetchAll();
      setGroups(data);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if(authStatus === 'idle') return;
    if (!user) {
      setGroups([]);
      setStatus('idle');
    } else {
      refetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus,user?.id]);

  const addGroup = useCallback(async (payload: Omit<Group, 'id' | 'createdAt'>) => {
    const tempId = `temp_${Date.now()}`;
    const optimistic: Group = { ...payload, id: tempId, createdAt: new Date().toISOString().split('T')[0] };
    setGroups(prev => [...prev, optimistic]);
    try {
      const created = await groupService.create(payload);
      setGroups(prev => prev.map(g => (g.id === tempId ? created : g)));
    } catch (err) {
      setGroups(prev => prev.filter(g => g.id !== tempId));
      throw new Error(parseApiError(err));
    }
  }, []);

  const updateGroup = useCallback(async (id: string, data: Partial<Group>) => {
    const previous = groups.find(g => g.id === id);
    setGroups(prev => prev.map(g => (g.id === id ? { ...g, ...data } : g)));
    try {
      const updated = await groupService.update(id, data);
      setGroups(prev => prev.map(g => (g.id === id ? updated : g)));
    } catch (err) {
      if (previous) setGroups(prev => prev.map(g => (g.id === id ? previous : g)));
      throw new Error(parseApiError(err));
    }
  }, [groups]);

  const deleteGroup = useCallback(async (id: string) => {
    const snapshot = groups.find(g => g.id === id);
    setGroups(prev => prev.filter(g => g.id !== id));
    try {
      await groupService.remove(id);
    } catch (err) {
      if (snapshot) setGroups(prev => [...prev, snapshot]);
      throw new Error(parseApiError(err));
    }
  }, [groups]);

  const addMember = useCallback(async (member: Omit<Member, 'id'>) => {
    const tempId = `temp_${Date.now()}`;
    setGroups(prev => prev.map(g => {
      if (g.id !== member.groupId) return g;
      if (g.members.some(m => m.email.toLowerCase() === member.email.toLowerCase())) return g;
      return { ...g, members: [...g.members, { ...member, id: tempId }] };
    }));
    try {
      const { groupId, ...rest } = member;
      const created = await groupService.addMember(groupId, rest);
      setGroups(prev => prev.map(g =>
        g.id === member.groupId
          ? { ...g, members: g.members.map(m => (m.id === tempId ? created : m)) }
          : g
      ));
    } catch (err) {
      setGroups(prev => prev.map(g =>
        g.id === member.groupId
          ? { ...g, members: g.members.filter(m => m.id !== tempId) }
          : g
      ));
      throw new Error(parseApiError(err));
    }
  }, []);

  const removeMember = useCallback(async (memberId: string, groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    const snapshot = group?.members.find(m => m.id === memberId);
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g
    ));
    try {
      await groupService.removeMember(groupId, memberId);
    } catch (err) {
      if (snapshot) {
        setGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, members: [...g.members, snapshot] } : g
        ));
      }
      throw new Error(parseApiError(err));
    }
  }, [groups]);

  const getGroupMembers = useCallback(
    (groupId: string) => groups.find(g => g.id === groupId)?.members ?? [],
    [groups],
  );

  return (
    <GroupContext.Provider value={{ groups, status, addGroup, updateGroup, deleteGroup, addMember, removeMember, getGroupMembers, refetch }}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroups = () => {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroups must be used within GroupProvider');
  return ctx;
};
