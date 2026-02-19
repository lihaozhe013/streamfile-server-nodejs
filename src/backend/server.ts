import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { FileEntry } from '@/backend/types/index';
import { handleSearchRequest } from '@/backend/utils/fileSearch';
import { isMediaExtension } from '@/backend/utils/isMediaExtension';
import {
  PRIVATE_DIR,
  UPLOAD_DIR,
  INCOMING_DIR,
  PUBLIC_DIR,
  DIST_DIR,
  HOST,
  PORT,
  LOCAL_IP,
  __dirname,
} from '@/backend/utils/paths';

const app = express();

app.use('/private-files', express.static(PRIVATE_DIR));

app.get(/^\/files(\/.*)?$/, (req: Request, res: Response, next: NextFunction) => {
  // Decode the URL component to get the actual path
  const prefix = '/files';
  let relativePath = req.path;
  if (relativePath.startsWith(prefix)) {
    relativePath = relativePath.substring(prefix.length);
  }
  const decodedPath = decodeURIComponent(relativePath);

  // Clean path to prevent directory traversal
  const safePath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(UPLOAD_DIR, safePath);

  // Security check: ensure path is within upload directory
  if (!fullPath.startsWith(UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Block access to the incoming directory
  if (fullPath.startsWith(INCOMING_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check if file/directory exists
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      return res.status(404).sendFile(path.join(PUBLIC_DIR, '404-index.html'));
    }

    if (stats.isDirectory()) {
      // Check if index.html exists
      const indexHtmlPath = path.join(fullPath, 'index.html');
      fs.access(indexHtmlPath, fs.constants.F_OK, (err) => {
        if (!err) {
          return res.sendFile(indexHtmlPath);
        } else {
          // Otherwise return file browser
          return res.sendFile(path.join(PUBLIC_DIR, 'file-browser.html'));
        }
      });
      return;
    }

    // It's a file
    const ext = path.extname(fullPath).toLowerCase();

    // Raw param forces direct file serving
    if (req.query.raw === '1') {
      return res.sendFile(fullPath);
    }

    // Markdown viewer
    if (ext === '.md') {
      return res.sendFile(path.join(PUBLIC_DIR, 'markdown-viewer/index.html'));
    }

    // Media player (video / audio)
    if (isMediaExtension(ext)) {
      return res.sendFile(path.join(PUBLIC_DIR, 'video-player.html'));
    }

    // Directly serve other files
    res.sendFile(fullPath);
  });
});

app.use(express.static(PUBLIC_DIR));
app.use(express.static(DIST_DIR)); // Serve dist files (including styles.css)

// API endpoint to get markdown content (kept as is for the viewer to fetch content)
app.get('/api/markdown-content', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }

  const decodedPath = decodeURIComponent(filePath);
  const fullPath = path.join(UPLOAD_DIR, decodedPath);

  // Block access to the incoming directory
  if (fullPath.startsWith(INCOMING_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fullPath.startsWith(UPLOAD_DIR)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (fs.existsSync(fullPath) && path.extname(fullPath).toLowerCase() === '.md') {
    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to read file' });
      }
      res.json({
        content: data,
        filename: path.basename(fullPath),
        path: decodedPath,
      });
    });
  } else {
    res.status(404).json({ error: 'File not found or not a markdown file' });
  }
});

// List files in subdirectories of files
app.get('/api/list-files', (req: Request, res: Response) => {
  const relativePath = (req.query.path as string) || '';
  const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(UPLOAD_DIR, safeRelativePath);

  if (!fullPath.startsWith(UPLOAD_DIR)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  // NOTE: fs.readdir is async, but using callback style here as per original
  fs.readdir(fullPath, { withFileTypes: true }, async (err, entries) => {
    if (err) return res.status(500).json({ error: 'Failed to read directory' });

    // Resolve symlinks to determine if they point to directories
    const files: FileEntry[] = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(fullPath, entry.name);
        let isDirectory = false;
        try {
          const stat = await fs.promises.stat(entryPath); // Follows symlinks
          isDirectory = stat.isDirectory();
        } catch (e) {
          // If error (broken link), assume not a directory
        }
        return {
          name: entry.name,
          isDirectory,
        };
      }),
    );

    // Filter out the incoming and private-files directories from file listings
    // Also filter out files and directories that start with '.'
    const filteredFiles = files.filter(
      (file) =>
        file.name !== 'incoming' && file.name !== 'private-files' && !file.name.startsWith('.'),
    );

    res.json(filteredFiles);
  });
});

// set up multer for file uploading
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, INCOMING_DIR),
  filename: function (req, file, cb) {
    // Chinese Character Support
    cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
  },
});
const upload = multer({ storage });

// file uploading port
app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  res.send({ message: 'File uploaded successfully!', file: req.file });
});

app.get(/^\/api\/search_feat\/file_name=([^/]+)\/current_dir=(.*)$/, handleSearchRequest);

// Main Page
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// start
app.listen(PORT, HOST, () => {
  console.log(`Server Started: http://${HOST === '0.0.0.0' ? LOCAL_IP : HOST}:${PORT}`);
});
