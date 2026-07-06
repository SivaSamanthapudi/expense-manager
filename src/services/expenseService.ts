import { Expense } from '../types';
import { apiClient } from './apiClient';

export const expenseService = {
  async fetchAll(): Promise<Expense[]> {
    const { data } = await apiClient.get<Expense[]>('/expenses');
    return data;
  },

  async fetchByGroup(groupId: string): Promise<Expense[]> {
    const { data } = await apiClient.get<Expense[]>(`/groups/${groupId}/expenses`);
    return data;
  },

  async create(payload: Omit<Expense, 'id'>): Promise<Expense> {
    const { data } = await apiClient.post<Expense>('/expenses', payload);
    return data;
  },

  async update(id: string, payload: Partial<Expense>): Promise<Expense> {
    const { data } = await apiClient.patch<Expense>(`/expenses/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/expenses/${id}`);
  },
};
