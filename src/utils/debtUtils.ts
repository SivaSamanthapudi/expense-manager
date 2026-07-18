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
    let net = 0;

    for (const e of groupExpenses) {
      const isPayer = e.paidBy === m.id;

      for (const split of e.splits) {
        const remaining = split.paid ? 0 : split.amount - (split.paidAmount ?? 0);

        if (split.memberId === m.id) {
          // This is my share — if I'm also the payer, I've already covered it (no net change)
          // If I'm NOT the payer, I owe `remaining` to the payer
          if (!isPayer) net -= remaining;
        } else if (isPayer) {
          // This is someone else's share that I paid for — they still owe me `remaining`
          net += remaining;
        }
      }
    }

    return { id: m.id, name: m.name, net };
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
