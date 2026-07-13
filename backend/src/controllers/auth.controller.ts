import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Group } from '../models/Group';
import { RefreshToken } from '../models/RefreshToken';
import { AuthRequest } from '../middleware/auth';

const generateAvatar = (name: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

const signAccessToken = (userId: string): string =>
  jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRY ??
      '15m') as jwt.SignOptions['expiresIn'],
  });

const signRefreshToken = (userId: string): string =>
  jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET as string, {
    expiresIn: (process.env.REFRESH_TOKEN_EXPIRY ??
      '7d') as jwt.SignOptions['expiresIn'],
  });

const saveRefreshToken = async (
  token: string,
  userId: string
): Promise<void> => {
  const expiry = process.env.REFRESH_TOKEN_EXPIRY ?? '7d';
  const days = parseInt(expiry, 10);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ token, userId, expiresAt });
};

const formatUser = (user: InstanceType<typeof User>) => ({
  id: (user._id as { toString(): string }).toString(),
  name: user.name,
  ...(user.email ? { email: user.email } : {}),
  ...(user.mobile ? { mobile: user.mobile } : {}),
  avatar: user.avatar,
  memberLinkStatus: user.memberLinkStatus,
});

/** Detect whether a string is an email or a mobile number */
const isMobile = (value: string) => /^\d{10}$/.test(value.trim());

/**
 * Find every group member record added as an unregistered guest with a
 * matching email or mobile and stamp the new userId onto them.
 * Returns the number of member records that were linked.
 * Throws on DB error so callers can set the failure flag.
 */
const linkGuestMembersToUser = async (
  userId: Types.ObjectId,
  email?: string,
  mobile?: string
): Promise<number> => {
  const $or: object[] = [];
  if (email) $or.push({ 'members.email': email.toLowerCase() });
  if (mobile) $or.push({ 'members.mobile': mobile.trim() });
  if ($or.length === 0) return 0;

  const groups = await Group.find({
    $or: $or.map((cond) => ({ ...cond, 'members.userId': { $exists: false } })),
  });

  let totalLinked = 0;
  for (const group of groups) {
    let modified = false;
    for (const member of group.members) {
      if (member.userId) continue;
      const emailMatch =
        email &&
        member.email &&
        member.email.toLowerCase() === email.toLowerCase();
      const mobileMatch =
        mobile && member.mobile && member.mobile.trim() === mobile.trim();
      if (emailMatch || mobileMatch) {
        member.userId = userId;
        modified = true;
        totalLinked++;
      }
    }
    if (modified) {
      group.markModified('members');
      await group.save();
    }
  }
  return totalLinked;
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, mobile, password } = req.body as {
      name: string;
      email?: string;
      mobile?: string;
      password: string;
    };

    if (!email && !mobile) {
      res
        .status(400)
        .json({ error: 'Either email or mobile number is required' });
      return;
    }

    // check uniqueness
    if (email) {
      const exists = await User.findOne({ email });
      if (exists) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
    }
    if (mobile) {
      const exists = await User.findOne({ mobile });
      if (exists) {
        res.status(409).json({ error: 'Mobile number already registered' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatar = generateAvatar(name);
    const user = await User.create({
      name,
      ...(email ? { email } : {}),
      ...(mobile ? { mobile } : {}),
      passwordHash,
      avatar,
    });

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    await saveRefreshToken(refreshToken, user._id.toString());

    // Synchronously link guest member records; set status flag on result
    try {
      await linkGuestMembersToUser(user._id as Types.ObjectId, email, mobile);
      user.memberLinkStatus = 'linked';
    } catch {
      user.memberLinkStatus = 'failed';
    }
    await user.save();

    res.status(201).json({ user: formatUser(user), accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body as {
      identifier: string;
      password: string;
    };

    if (!identifier) {
      res.status(400).json({ error: 'Email or mobile number is required' });
      return;
    }

    // find by email or mobile
    const query = isMobile(identifier)
      ? { mobile: identifier.trim() }
      : { email: identifier.trim().toLowerCase() };

    const user = await User.findOne(query);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    await saveRefreshToken(refreshToken, user._id.toString());

    res.json({ user: formatUser(user), accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during logout' });
  }
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const relink = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    try {
      await linkGuestMembersToUser(
        user._id as Types.ObjectId,
        user.email,
        user.mobile
      );
      user.memberLinkStatus = 'linked';
    } catch {
      user.memberLinkStatus = 'failed';
    }
    await user.save();
    res.json({ memberLinkStatus: user.memberLinkStatus });
  } catch (err) {
    res.status(500).json({ error: 'Server error during re-link' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    let payload: { userId: string };
    try {
      payload = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET as string
      ) as {
        userId: string;
      };
    } catch {
      await RefreshToken.deleteOne({ token: refreshToken });
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }

    await RefreshToken.deleteOne({ token: refreshToken });
    const newAccessToken = signAccessToken(payload.userId);
    const newRefreshToken = signRefreshToken(payload.userId);
    await saveRefreshToken(newRefreshToken, payload.userId);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(500).json({ error: 'Server error during token refresh' });
  }
};
