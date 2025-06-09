import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import serveIndex from 'serve-index';
import path from 'path';
import fs from 'fs';
import os from 'os';

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8000', 10);
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const INCOMING_DIR = path.join(__dirname, '../uploads/incoming');
const PRIVATE_DIR = path.join(__dirname, '../uploads/private-files');
const PUBLIC_DIR = path.join(__dirname, '../public');

function getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const interface_ = interfaces[interfaceName];
        if (interface_) {
            for (const iface of interface_) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
    }
    return '0.0.0.0';
}

const LOCAL_IP = getLocalIP();

// create folder 'upload' if dne
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(INCOMING_DIR)) {
    fs.mkdirSync(INCOMING_DIR, { recursive: true });
}

if (!fs.existsSync(PRIVATE_DIR)) {
    fs.mkdirSync(PRIVATE_DIR, { recursive: true });
}

// Serve private files directly by URL (but don't list them in browser)
app.use('/private-files', express.static(PRIVATE_DIR));

app.get('/files/*', (req: Request, res: Response, next: NextFunction) => {
    const decodedPath = decodeURIComponent(req.path.substring(7));
    const filePath = path.join(UPLOAD_DIR, decodedPath);

    // Block access to the incoming directory
    if (filePath.startsWith(INCOMING_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            const indexHtmlPath = path.join(filePath, 'index.html');
            fs.access(indexHtmlPath, fs.constants.F_OK, (err) => {
                if (!err) {
                    return res.sendFile(indexHtmlPath);
                } else {
                    return res.sendFile(path.join(__dirname, '../public/file-browser/file-browser.html'));
                }
            });
        } else {
            next(); // not a directory, go to next handler
        }
    });
});

// Intercept requests for markdown files
app.get('/files/*', (req: Request, res: Response, next: NextFunction) => {
    // Decode the URL component to get the actual filename
    const decodedPath = decodeURIComponent(req.path.substring(7)); // Remove '/files/' prefix
    const filePath = path.join(UPLOAD_DIR, decodedPath);
    
    // Block access to the incoming directory
    if (filePath.startsWith(INCOMING_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (fs.existsSync(filePath) && path.extname(filePath).toLowerCase() === '.md') {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return next(err);
            }
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Markdown Preview - ${path.basename(filePath)}</title>
                    <link rel="stylesheet" href="/output.css">
                </head>
                <body>
                    <div id="root"></div>
                    <script>
                        window.markdownContent = ${JSON.stringify(data)};
                    </script>
                    <script src="/markdown-viewer/bundle.js"></script>
                </body>
                </html>
            `);
        });
    } else {
        next();
    }
});

// setup static files (after the markdown interceptor)
app.use('/files', express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));

// Serve custom file browser UI for /files and all nested paths
app.get('/files', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/file-browser/file-browser.html'));
});

interface FileEntry {
    name: string;
    isDirectory: boolean;
}

// List files in subdirectories of uploads
app.get('/api/list-files', (req: Request, res: Response) => {
    const relativePath = req.query.path as string || '';
    const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(UPLOAD_DIR, safeRelativePath);

    if (!fullPath.startsWith(UPLOAD_DIR)) {
        return res.status(400).json({ error: 'Invalid path' });
    }

    fs.readdir(fullPath, { withFileTypes: true }, async (err, entries) => {
        if (err) return res.status(500).json({ error: 'Failed to read directory' });

        // Resolve symlinks to determine if they point to directories
        const files: FileEntry[] = await Promise.all(entries.map(async entry => {
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
                isDirectory
            };
        }));

        // Filter out the incoming and private-files directories from file listings
        const filteredFiles = files.filter(file => file.name !== 'incoming' && file.name !== 'private-files');

        res.json(filteredFiles);
    });
});

// set up multer for file uploading
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, INCOMING_DIR),
    filename: function (req, file, cb) { // Chinese Character Support
        cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
    }
});
const upload = multer({ storage });

// file uploading port
app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    res.send({ message: 'File uploaded successfully!', file: req.file });
});

// Main Page
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// start
app.listen(PORT, HOST, () => {
    console.log(`Server Started: http://${HOST === '0.0.0.0' ? LOCAL_IP : HOST}:${PORT}`);
}); 