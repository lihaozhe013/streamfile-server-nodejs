const express = require('express');
const multer = require('multer');
const serveIndex = require('serve-index');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 8000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const NEW_UPLOAD_DIR = path.join(__dirname, 'uploads/new_upload_things');
const PUBLIC_DIR = path.join(__dirname, 'public');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const interface = interfaces[interfaceName];
        for (const iface of interface) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
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

if (!fs.existsSync(NEW_UPLOAD_DIR)) {
    fs.mkdirSync(NEW_UPLOAD_DIR, { recursive: true });
}

// Intercept requests for markdown files
app.get('/files/*', (req, res, next) => {
    // Decode the URL component to get the actual filename
    const decodedPath = decodeURIComponent(req.path.substring(7)); // Remove '/files/' prefix
    const filePath = path.join(UPLOAD_DIR, decodedPath);
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
                    <link rel="stylesheet" href="/markdown-viewer/styles.css">
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

// Automatically serve index.html inside folders
app.use('/files', async (req, res, next) => {
    const requestedPath = path.join(UPLOAD_DIR, decodeURIComponent(req.path));
    try {
        const stat = await fs.promises.stat(requestedPath);
        if (stat.isDirectory()) {
            const indexPath = path.join(requestedPath, 'index.html');
            console.log(indexPath);
            if (fs.existsSync(indexPath)) {
                return res.sendFile(indexPath);
            }
        }
    } catch (err) {
        // Ignore and let next middleware handle
    }

    next(); // Not a directory or no index.html, continue to static handler
});

// setup static files (after the markdown interceptor)
app.use('/files', express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));

// Serve custom file browser UI for /files and all nested paths
app.get('/files', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/custom-file-browser.html'));
});

// List files in subdirectories of uploads
app.get('/api/list-files', (req, res) => {
    const relativePath = req.query.path || '';
    const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(UPLOAD_DIR, safeRelativePath);

    if (!fullPath.startsWith(UPLOAD_DIR)) {
        return res.status(400).json({ error: 'Invalid path' });
    }

    fs.readdir(fullPath, { withFileTypes: true }, async (err, entries) => {
        if (err) return res.status(500).json({ error: 'Failed to read directory' });

        // Resolve symlinks to determine if they point to directories
        const files = await Promise.all(entries.map(async entry => {
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

        res.json(files);
    });
});


// set up multer for file uploading
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, NEW_UPLOAD_DIR),
    filename: function (req, file, cb) { // Chinese Character Support
        cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
    }
});
const upload = multer({ storage });

// file uploading port
app.post('/upload', upload.single('file'), (req, res) => {
    res.send({ message: 'File uploaded successfully!', file: req.file });
});

// Main Page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// start
app.listen(PORT, HOST, () => {
    console.log(`Server Started: http://${HOST === '0.0.0.0' ? LOCAL_IP : HOST}:${PORT}`);
});