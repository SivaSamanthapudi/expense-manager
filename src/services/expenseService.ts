import { apiClient } from './apiClient';
import { Expense, ExpenseHistoryEntry } from '../types';

export const expenseService = {
  async fetchAll(): Promise<Expense[]> {
    const { data } = await apiClient.get<Expense[]>('/expenses');
    return data;
  },

  async fetchByGroup(groupId: string): Promise<Expense[]> {
    const { data } = await apiClient.get<Expense[]>(`/groups/${groupId}/expenses`);
    return data;
  },

  async create(payload: Omit<Expense, 'id'>, receipts?: File[]): Promise<Expense> {
    const form = buildFormData(payload, receipts);
    const { data } = await apiClient.post<Expense>('/expenses', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async update(
    id: string,
    payload: Partial<Expense>,
    newFiles?: File[],
    keepUrls?: string[]
  ): Promise<Expense> {
    const form = buildFormData(payload, newFiles, keepUrls);
    const { data } = await apiClient.patch<Expense>(`/expenses/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/expenses/${id}`);
  },

  async fetchHistory(id: string): Promise<ExpenseHistoryEntry[]> {
    const { data } = await apiClient.get<ExpenseHistoryEntry[]>(`/expenses/${id}/history`);
    return data;
  },
};

function buildFormData(
  payload: Record<string, unknown>,
  files?: File[],
  keepUrls?: string[]
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'receiptUrls') continue; // managed separately
    if (value === null || value === undefined) continue;
    if (key === 'splits') {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }
  // Tell the server which existing URLs to keep
  if (keepUrls !== undefined) {
    form.append('keepReceiptUrls', JSON.stringify(keepUrls));
  }
  // Append each new file under the shared field name 'receipts'
  if (files && files.length > 0) {
    for (const file of files) {
      form.append('receipts', file);
    }
  }
  return form;
}
