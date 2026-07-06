import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Expense } from '../types';
import { expenseService } from '../services/expenseService';
import { parseApiError } from '../services/authService';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExpenseContextType {
  expenses: Expense[];
  status: LoadStatus;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getGroupExpenses: (groupId: string) => Expense[];
  refetch: () => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType | null>(null);

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');

  const refetch = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await expenseService.fetchAll();
      setExpenses(data);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const addExpense = useCallback(async (payload: Omit<Expense, 'id'>) => {
    const tempId = `temp_${Date.now()}`;
    setExpenses(prev => [...prev, { ...payload, id: tempId }]);
    try {
      const created = await expenseService.create(payload);
      setExpenses(prev => prev.map(e => (e.id === tempId ? created : e)));
    } catch (err) {
      setExpenses(prev => prev.filter(e => e.id !== tempId));
      throw new Error(parseApiError(err));
    }
  }, []);

  const updateExpense = useCallback(async (id: string, data: Partial<Expense>) => {
    const previous = expenses.find(e => e.id === id);
    setExpenses(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));
    try {
      const updated = await expenseService.update(id, data);
      setExpenses(prev => prev.map(e => (e.id === id ? updated : e)));
    } catch (err) {
      if (previous) setExpenses(prev => prev.map(e => (e.id === id ? previous : e)));
      throw new Error(parseApiError(err));
    }
  }, [expenses]);

  const deleteExpense = useCallback(async (id: string) => {
    const snapshot = expenses.find(e => e.id === id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      await expenseService.remove(id);
    } catch (err) {
      if (snapshot) setExpenses(prev => [...prev, snapshot]);
      throw new Error(parseApiError(err));
    }
  }, [expenses]);

  const getGroupExpenses = useCallback(
    (groupId: string) => expenses.filter(e => e.groupId === groupId),
    [expenses],
  );

  return (
    <ExpenseContext.Provider value={{ expenses, status, addExpense, updateExpense, deleteExpense, getGroupExpenses, refetch }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpenses must be used within ExpenseProvider');
  return ctx;
};
