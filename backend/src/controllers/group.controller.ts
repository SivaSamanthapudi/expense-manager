import { Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { Group, IGroup } from '../models/Group';
import { Expense } from '../models/Expense';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';

const formatGroup = (group: InstanceType<typeof Group>) => ({
  id: group._id.toString(),
  name: group.name,
  description: group.description,
  category: group.category,
  simplifyDebts: group.simplifyDebts,
  createdBy: group.createdBy.toString(),
  createdAt: group.createdAt,
  members: group.members.map((m) => ({
    id: m._id.toString(),
    name: m.name,
    email: m.email ?? '',
    avatar: m.avatar,
    groupId: group._id.toString(),
    userId: m.userId?.toString() ?? null,
  })),
});

/** Build a query that matches groups the caller is either the creator of OR a member of. */
const membershipQuery = async (
  userId: string
): Promise<FilterQuery<IGroup>> => {
  const user = await User.findById(userId).select('email mobile');
  // Match as creator OR as a linked member (userId), OR by email/mobile for legacy records
  const $or: object[] = [
    { createdBy: new Types.ObjectId(userId) },
    { 'members.userId': new Types.ObjectId(userId) },
  ];
  if (user?.email) $or.push({ 'members.email': user.email });
  if (user?.mobile) $or.push({ 'members.mobile': user.mobile });
  return { $or };
};

/** Verify the caller has access to a specific group (creator or member). */
const findAccessibleGroup = async (groupId: string, userId: string) => {
  const query = await membershipQuery(userId);
  return Group.findOne({ _id: groupId, ...query });
};

export const getGroups = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const query = await membershipQuery(req.userId!);
    const groups = await Group.find(query);
    res.json(groups.map(formatGroup));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const createGroup = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, category, simplifyDebts, members } =
      req.body as {
        name: string;
        description?: string;
        category?: string;
        simplifyDebts?: boolean;
        members?: Array<{ name: string; email?: string; avatar?: string }>;
      };

    // Resolve userIds for members that have a matching registered user
    const resolvedMembers = await Promise.all(
      (members ?? []).map(async (m) => {
        const registeredUser = m.email
          ? await User.findOne({ email: m.email.toLowerCase() }).select('_id')
          : null;
        return {
          _id: new Types.ObjectId(),
          name: m.name,
          email: m.email ?? '',
          avatar:
            m.avatar ??
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
              m.name
            )}`,
          userId: registeredUser?._id ?? undefined,
        };
      })
    );

    const group = await Group.create({
      name,
      description: description ?? '',
      category: category ?? 'other',
      simplifyDebts: simplifyDebts ?? false,
      createdBy: req.userId,
      members: resolvedMembers,
    });

    res.status(201).json(formatGroup(group));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create group';
    res.status(500).json({ error: msg });
  }
};

export const updateGroup = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check group exists at all first
    const exists = await Group.findById(req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Any member (creator or participant) can update group details
    const accessible = await findAccessibleGroup(req.params.id, req.userId!);
    if (!accessible) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const updated = await Group.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(formatGroup(updated!));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update group';
    res.status(500).json({ error: msg });
  }
};

export const deleteGroup = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check group exists at all first
    const exists = await Group.findById(req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Only the creator can delete a group
    if (exists.createdBy.toString() !== req.userId) {
      res
        .status(403)
        .json({ error: 'Only the group creator can delete this group' });
      return;
    }

    await Group.findByIdAndDelete(req.params.id);
    await Expense.deleteMany({ groupId: exists._id });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete group';
    res.status(500).json({ error: msg });
  }
};

export const addMember = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      email,
      avatar,
      userId: providedUserId,
    } = req.body as {
      name: string;
      email?: string;
      avatar?: string;
      userId?: string | null;
    };

    // Any group member (not just creator) can add new members
    const group = await findAccessibleGroup(req.params.groupId, req.userId!);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Resolve the registered user: prefer the explicit userId from the client,
    // fall back to email lookup so legacy/manual flows still work.
    let resolvedUserId: Types.ObjectId | undefined;
    if (providedUserId) {
      const found = await User.findById(providedUserId).select('_id');
      resolvedUserId = found?._id as Types.ObjectId | undefined;
    } else if (email) {
      const found = await User.findOne({ email: email.toLowerCase() }).select(
        '_id'
      );
      resolvedUserId = found?._id as Types.ObjectId | undefined;
    }

    // Prevent duplicate: userId takes priority, then email
    if (
      resolvedUserId &&
      group.members.some(
        (m) => m.userId?.toString() === resolvedUserId!.toString()
      )
    ) {
      res
        .status(409)
        .json({ error: 'This user is already a member of the group' });
      return;
    }
    if (
      !resolvedUserId &&
      email &&
      group.members.some((m) => m.email?.toLowerCase() === email.toLowerCase())
    ) {
      res
        .status(409)
        .json({
          error: 'A member with this email already exists in the group',
        });
      return;
    }

    const memberId = new Types.ObjectId();
    const memberAvatar =
      avatar ??
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        name
      )}`;
    const newMember = {
      _id: memberId,
      name,
      email: email ?? '',
      avatar: memberAvatar,
      userId: resolvedUserId,
    };

    group.members.push(newMember as (typeof group.members)[0]);
    await group.save();

    res.status(201).json({
      id: memberId.toString(),
      name,
      email: email ?? '',
      avatar: memberAvatar,
      groupId: group._id.toString(),
      userId: resolvedUserId?.toString() ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeMember = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Any group member can remove others
    const group = await findAccessibleGroup(req.params.groupId, req.userId!);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const before = group.members.length;
    group.members = group.members.filter(
      (m) => m._id.toString() !== req.params.memberId
    ) as typeof group.members;

    if (group.members.length === before) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    await group.save();
    res.json({ message: 'Member removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PATCH /api/groups/:groupId/payments
 * Body: { fromMemberId, toMemberId, amount }
 *
 * Distributes `amount` across unpaid/partial splits where:
 *   - split.memberId === fromMemberId  (the debtor)
 *   - expense.paidBy === toMemberId    (the creditor)
 *
 * Marks splits fully paid when paidAmount reaches their full amount.
 */
export const recordPayment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { fromMemberId, toMemberId, amount } = req.body as {
      fromMemberId: string;
      toMemberId: string;
      amount: number;
    };

    if (!fromMemberId || !toMemberId || !amount || amount <= 0) {
      res
        .status(400)
        .json({
          error: 'fromMemberId, toMemberId and a positive amount are required',
        });
      return;
    }

    const group = await findAccessibleGroup(groupId, req.userId!);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Fetch all unpaid/partial expenses in this group where the creditor paid
    const expenses = await Expense.find({
      groupId: group._id,
      paidBy: toMemberId,
      'splits.memberId': fromMemberId,
    });

    let remaining = amount;
    const updatedExpenses = [];

    for (const expense of expenses) {
      if (remaining <= 0) break;
      const split = expense.splits.find(
        (s) => s.memberId === fromMemberId && !s.paid
      );
      if (!split) continue;

      const alreadyPaid = split.paidAmount ?? 0;
      const stillOwed = split.amount - alreadyPaid;
      if (stillOwed <= 0) continue;

      const paying = Math.min(remaining, stillOwed);
      split.paidAmount = parseFloat((alreadyPaid + paying).toFixed(2));
      split.paid = split.paidAmount >= split.amount - 0.01;
      remaining = parseFloat((remaining - paying).toFixed(2));

      expense.markModified('splits');
      updatedExpenses.push(expense.save());
    }

    await Promise.all(updatedExpenses);

    const appliedAmount = parseFloat((amount - remaining).toFixed(2));

    // Persist the payment history record
    const fromMember = group.members.find(
      (m) => m._id.toString() === fromMemberId
    );
    const toMember = group.members.find((m) => m._id.toString() === toMemberId);
    await Payment.create({
      groupId: group._id,
      fromMemberId,
      fromMemberName: fromMember?.name ?? fromMemberId,
      toMemberId,
      toMemberName: toMember?.name ?? toMemberId,
      amount,
      appliedAmount,
    });

    res.json({
      message: 'Payment recorded',
      appliedAmount,
      leftover: remaining,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
};

export const getPayments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const group = await findAccessibleGroup(req.params.groupId, req.userId!);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const payments = await Payment.find({ groupId: group._id }).sort({
      createdAt: -1,
    });
    res.json(
      payments.map((p) => ({
        id: p._id.toString(),
        groupId: p.groupId.toString(),
        fromMemberId: p.fromMemberId,
        fromMemberName: p.fromMemberName,
        toMemberId: p.toMemberId,
        toMemberName: p.toMemberName,
        amount: p.amount,
        appliedAmount: p.appliedAmount,
        date: p.date,
      }))
    );
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const getGroupExpenses = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const group = await findAccessibleGroup(req.params.groupId, req.userId!);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const expenses = await Expense.find({ groupId: group._id }).sort({
      date: -1,
    });
    res.json(
      expenses.map((e) => ({
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
      }))
    );
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};
