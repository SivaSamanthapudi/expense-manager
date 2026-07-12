import { apiClient } from './apiClient';
import { Group, Member, PaymentRecord } from '../types';

export interface UserSuggestion {
  id: string;
  name: string;
  email: string;
  mobile: string;
  avatar: string;
}

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

  async searchUsers(q: string): Promise<UserSuggestion[]> {
    if (!q.trim()) return [];
    const { data } = await apiClient.get<UserSuggestion[]>(`/users/search?q=${encodeURIComponent(q)}`);
    return data;
  },

  async getPayments(groupId: string): Promise<PaymentRecord[]> {
    const { data } = await apiClient.get<PaymentRecord[]>(`/groups/${groupId}/payments`);
    return data;
  },

  async recordPayment(
    groupId: string,
    fromMemberId: string,
    toMemberId: string,
    amount: number
  ): Promise<{ appliedAmount: number; leftover: number }> {
    const { data } = await apiClient.patch(`/groups/${groupId}/payments`, {
      fromMemberId,
      toMemberId,
      amount,
    });
    return data;
  },
};
