import { Group, Expense } from '../types';

export interface DebtTransaction {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface MemberBalance {
  id: string;
  name: string;
  net: number;
}

export const computeMemberBalances = (group: Group, expenses: Expense[]): MemberBalance[] => {
  const groupExpenses = expenses.filter(e => e.groupId === group.id);
  return group.members.map(m => {
    const paid = groupExpenses
      .filter(e => e.paidBy === m.id)
      .reduce((s, e) => s + e.amount, 0);
    const share = groupExpenses.reduce((s, e) => {
      const split = e.splits.find(sp => sp.memberId === m.id);
      return s + (split?.amount ?? 0);
    }, 0);
    return { id: m.id, name: m.name, net: paid - share };
  });
};

export const simplifyDebts = (balances: MemberBalance[]): DebtTransaction[] => {
  const creditors = balances.filter(b => b.net > 0.01).map(b => ({ ...b })).sort((a, b) => b.net - a.net);
  const debtors   = balances.filter(b => b.net < -0.01).map(b => ({ ...b })).sort((a, b) => a.net - b.net);

  const transactions: DebtTransaction[] = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = parseFloat(Math.min(creditors[i].net, -debtors[j].net).toFixed(2));
    transactions.push({ fromId: debtors[j].id, fromName: debtors[j].name, toId: creditors[i].id, toName: creditors[i].name, amount });
    creditors[i].net -= amount;
    debtors[j].net   += amount;
    if (Math.abs(creditors[i].net) < 0.01) i++;
    if (Math.abs(debtors[j].net)   < 0.01) j++;
  }
  return transactions;
};
