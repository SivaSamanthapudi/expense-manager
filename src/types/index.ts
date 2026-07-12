export const GroupCategory = {
  Trip: 'trip',
  Home: 'home',
  Food: 'food',
  Other: 'other',
} as const;
export type GroupCategory = (typeof GroupCategory)[keyof typeof GroupCategory];
export const GROUP_CATEGORIES = Object.values(GroupCategory);

export const ExpenseCategory = {
  Food: 'food',
  Transport: 'transport',
  Accommodation: 'accommodation',
  Entertainment: 'entertainment',
  Utilities: 'utilities',
  Other: 'other',
} as const;
export type ExpenseCategory =
  (typeof ExpenseCategory)[keyof typeof ExpenseCategory];
export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  avatar: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string;
  groupId: string;
  userId?: string | null; // auth user id — set only for registered SplitWise users
}

export interface Group {
  id: string;
  name: string;
  description: string;
  category: GroupCategory;
  simplifyDebts: boolean;
  members: Member[];
  createdAt: string;
  createdBy: string;
}

export interface ExpenseSplit {
  memberId: string;
  memberName: string;
  amount: number;
  paid: boolean;
  paidAmount?: number;
}

export interface PaymentRecord {
  id: string;
  groupId: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
  appliedAmount: number;
  date: string;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: string;
  paidByName: string;
  splits: ExpenseSplit[];
  date: string;
  notes: string;
  receiptUrls?: string[];
}
