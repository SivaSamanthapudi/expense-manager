import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const storage: StorageEngine = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'receipts'),
  filename: (_req: Request, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

export const receiptUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 10,                  // max 10 attachments
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, WebP, GIF) and PDF files are allowed'));
    }
  },
}).array('receipts', 10);
