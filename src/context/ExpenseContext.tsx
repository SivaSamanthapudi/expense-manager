import { createContext, useContext, useState, ReactNode } from 'react';
import { Expense, ExpenseCategory } from '../types';

interface ExpenseContextType {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  getGroupExpenses: (groupId: string) => Expense[];
}

const SEED_EXPENSES: Expense[] = [
  {
    id: 'e1', groupId: 'g1', title: 'Hotel Booking', amount: 9000,
    category: ExpenseCategory.Accommodation, paidBy: 'm1', paidByName: 'Alice Johnson',
    splits: [
      { memberId: 'm1', memberName: 'Alice Johnson', amount: 3000, paid: true },
      { memberId: 'm2', memberName: 'Bob Smith', amount: 3000, paid: false },
      { memberId: 'm3', memberName: 'Carol White', amount: 3000, paid: false },
    ],
    date: '2024-12-10', notes: 'Beach resort for 2 nights',
  },
  {
    id: 'e2', groupId: 'g1', title: 'Dinner at Thalassa', amount: 2400,
    category: ExpenseCategory.Food, paidBy: 'm2', paidByName: 'Bob Smith',
    splits: [
      { memberId: 'm1', memberName: 'Alice Johnson', amount: 800, paid: false },
      { memberId: 'm2', memberName: 'Bob Smith', amount: 800, paid: true },
      { memberId: 'm3', memberName: 'Carol White', amount: 800, paid: false },
    ],
    date: '2024-12-11', notes: '',
  },
  {
    id: 'e3', groupId: 'g2', title: 'Electricity Bill', amount: 1800,
    category: ExpenseCategory.Utilities, paidBy: 'm4', paidByName: 'David Lee',
    splits: [
      { memberId: 'm4', memberName: 'David Lee', amount: 900, paid: true },
      { memberId: 'm5', memberName: 'Eva Green', amount: 900, paid: false },
    ],
    date: '2024-12-05', notes: 'December bill',
  },
  {
    id: 'e4', groupId: 'g3', title: 'Flight tickets', amount: 15000,
    category: ExpenseCategory.Transport, paidBy: 'm6', paidByName: 'Siva',
    splits: [
      { memberId: 'm6', memberName: 'Siva', amount: 5000, paid: true },
      { memberId: 'm7', memberName: 'Anuja', amount: 5000, paid: false },
      { memberId: 'm8', memberName: 'Ojasvi', amount: 5000, paid: false },
    ],
    date: '2025-05-27', notes: 'Round trip tickets',
  },
  {
    id: 'e5', groupId: 'g3', title: 'Toys', amount: 2000,
    category: ExpenseCategory.Other, paidBy: 'm7', paidByName: 'Anuja',
    splits: [
      { memberId: 'm7', memberName: 'Anuja', amount: 0, paid: true },
      { memberId: 'm8', memberName: 'Ojasvi', amount: 2000, paid: false },
    ],
    date: '2025-05-27', notes: '',
  },
];

const ExpenseContext = createContext<ExpenseContextType | null>(null);

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>(SEED_EXPENSES);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    setExpenses(prev => [...prev, { ...expense, id: Date.now().toString() }]);
  };

  const updateExpense = (id: string, data: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const getGroupExpenses = (groupId: string) =>
    expenses.filter(e => e.groupId === groupId);

  return (
    <ExpenseContext.Provider value={{ expenses, addExpense, updateExpense, deleteExpense, getGroupExpenses }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpenses must be used within ExpenseProvider');
  return ctx;
};
