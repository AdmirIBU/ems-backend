import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadRoot = path.join(process.cwd(), 'private_uploads', 'course-materials');
fs.mkdirSync(uploadRoot, { recursive: true });

function safeBaseName(name: string) {
  const ext = path.extname(name);
  const base = path.basename(name, ext).replace(/[^a-z0-9-_]/gi, '-');
  return { base, ext };
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const courseId = String((req as any).params?.id ?? 'unknown');
    const dir = path.join(uploadRoot, courseId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const { base, ext } = safeBaseName(file.originalname);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const allowedMimetypes = new Set([
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  // common images (sometimes used in labs)
  'image/png',
  'image/jpeg',
  // videos
  'video/mp4',
  'video/webm',
  'video/ogg',
]);

const upload = multer({
  storage,
  limits: {
    // 200MB default (videos can be large)
    fileSize: 200 * 1024 * 1024,
  },
  fileFilter: function (req, file, cb) {
    if (allowedMimetypes.has(file.mimetype) || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    return cb(new Error('Unsupported file type'));
  },
});

export default upload;
