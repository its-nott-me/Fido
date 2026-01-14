import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(process.cwd(), '/tmp');
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with user id and timestamp
    const filename = `${req.user.id}_${Date.now()}-${file.originalname}`;
    cb(null, filename); // Set the filename
  }
});

export const upload = multer({ storage });
