import { Group, Member } from '../types';
import { apiClient } from './apiClient';

export const groupService = {
  async fetchAll(): Promise<Group[]> {
    const { data } = await apiClient.get<Group[]>('/groups');
    return data;
  },

  async create(payload: Omit<Group, 'id' | 'createdAt'>): Promise<Group> {
    const { data } = await apiClient.post<Group>('/groups', payload);
    return data;
  },

  async update(id: string, payload: Partial<Group>): Promise<Group> {
    const { data } = await apiClient.patch<Group>(`/groups/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/groups/${id}`);
  },

  // Members are nested under a group
  async addMember(groupId: string, payload: Omit<Member, 'id' | 'groupId'>): Promise<Member> {
    const { data } = await apiClient.post<Member>(`/groups/${groupId}/members`, payload);
    return data;
  },

  async removeMember(groupId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/groups/${groupId}/members/${memberId}`);
  },
};
