export const VALIDATION_ERROR = 'ValidationError';

export const SECRET_KEY = 'SIVA_9876_SECRET_KEY_1234';

import { MemberLinkStatus } from './types';

export const MEMBER_LINK_STATUSES: [MemberLinkStatus, ...MemberLinkStatus[]] = [
  'pending',
  'linked',
  'failed',
];
