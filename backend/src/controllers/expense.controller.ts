import { Response, Request } from 'express';
import path from 'path';
import fs from 'fs';
import { Types } from 'mongoose';
import { Group } from '../models/Group';
import { Expense } from '../models/Expense';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';

interface MulterRequest extends Request {
  files?: Express.Multer.File[];
}

const formatExpense = (e: InstanceType<typeof Expense>) => ({
  id: e._id.toString(),
  groupId: e.groupId.toString(),
  title: e.title,
  amount: e.amount,
  category: e.category,
  paidBy: e.paidBy,
  paidByName: e.paidByName,
  splits: e.splits,
  date: e.date,
  notes: e.notes,
  receiptUrls: e.receiptUrls ?? [],
});

/** Returns IDs of all groups the user is either the creator of or a member of. */
const getUserGroupIds = async (userId: string): Promise<string[]> => {
  const user = await User.findById(userId).select('email mobile');
  const $or: object[] = [{ createdBy: new Types.ObjectId(userId) }];
  if (user?.email) $or.push({ 'members.email': user.email });
  if (user?.mobile) $or.push({ 'members.mobile': user.mobile });
  const groups = await Group.find({ $or }).select('_id');
  return groups.map((g) => g._id.toString());
};

const deleteFiles = (urls: string[]) => {
  for (const url of urls) {
    const filePath = path.join(__dirname, '..', '..', url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};

export const getExpenses = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const groupIds = await getUserGroupIds(req.userId!);
    const expenses = await Expense.find({ groupId: { $in: groupIds } }).sort({
      date: -1,
    });
    res.json(expenses.map(formatExpense));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const createExpense = async (
  req: MulterRequest & AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      groupId,
      title,
      amount,
      category,
      paidBy,
      paidByName,
      splits,
      date,
      notes,
    } = req.body as {
      groupId: string;
      title: string;
      amount: number;
      category?: string;
      paidBy: string;
      paidByName: string;
      splits?: Array<{
        memberId: string;
        memberName: string;
        amount: number;
        paid: boolean;
      }>;
      date: string;
      notes?: string;
    };

    // Any group member can create an expense in that group
    const groupIds = await getUserGroupIds(req.userId!);
    if (!groupIds.includes(groupId)) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }
    const group = await Group.findById(groupId);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
    const receiptUrls = uploadedFiles.map(
      (f) => `/uploads/receipts/${f.filename}`
    );

    const parsedSplits =
      typeof splits === 'string' ? JSON.parse(splits) : splits;

    const expense = await Expense.create({
      groupId,
      title,
      amount,
      category: category ?? 'other',
      paidBy,
      paidByName,
      splits: parsedSplits ?? [],
      date: new Date(date),
      notes: notes ?? '',
      receiptUrls,
    });

    res.status(201).json(formatExpense(expense));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create expense';
    res.status(500).json({ error: msg });
  }
};

export const updateExpense = async (
  req: MulterRequest & AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    // Only group members can edit expenses
    const groupIds = await getUserGroupIds(req.userId!);
    if (!groupIds.includes(expense.groupId.toString())) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    // URLs to keep (sent by client as JSON array string)
    const keepUrlsRaw = req.body.keepReceiptUrls as string | undefined;
    const keepUrls: string[] = keepUrlsRaw
      ? JSON.parse(keepUrlsRaw)
      : expense.receiptUrls;

    // Delete files that were removed (in existing but not in keepUrls)
    const toDelete = expense.receiptUrls.filter((u) => !keepUrls.includes(u));
    deleteFiles(toDelete);

    // Add newly uploaded files
    const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
    const newUrls = uploadedFiles.map((f) => `/uploads/receipts/${f.filename}`);

    expense.receiptUrls = [...keepUrls, ...newUrls];

    const {
      keepReceiptUrls: _k,
      receiptUrls: _r,
      splits: rawSplits,
      ...rest
    } = req.body as {
      keepReceiptUrls?: string;
      receiptUrls?: unknown;
      splits?: string;
      [key: string]: unknown;
    };

    if (rawSplits) {
      rest.splits =
        typeof rawSplits === 'string' ? JSON.parse(rawSplits) : rawSplits;
    }

    Object.assign(expense, rest);
    await expense.save();
    res.json(formatExpense(expense));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create expense';
    res.status(500).json({ error: msg });
  }
};

export const deleteExpense = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    // Only group members can delete expenses
    const groupIds = await getUserGroupIds(req.userId!);
    if (!groupIds.includes(expense.groupId.toString())) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    deleteFiles(expense.receiptUrls ?? []);
    await expense.deleteOne();
    res.json({ message: 'Expense deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};
