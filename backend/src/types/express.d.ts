import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      userData?: {
        userId: Types.ObjectId | string;
        email?: string;
      };
    }
  }
}

export {};
