import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
const { searchFilesInPath, searchFilesStructured } = require('../dist/search_feat/index.js');
import path from 'path';
import fs from 'fs';
import os from 'os';

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '80', 10);
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const INCOMING_DIR = path.join(__dirname, '../uploads/incoming');
const PRIVATE_DIR = path.join(__dirname, '../uploads/private-files');
const PUBLIC_DIR = path.join(__dirname, '../public');
const DIST_DIR = path.join(__dirname, '..');

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
                    return res.sendFile(path.join(__dirname, '../public/file-browser.html'));
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
                    <link rel="stylesheet" href="/dist/output.css">
                </head>
                <body>
                    <div id="root"></div>
                    <script>
                        window.markdownContent = ${JSON.stringify(data)};
                    </script>
                    <script src="/dist/markdown-viewer/bundle.js"></script>
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
app.use(express.static(DIST_DIR)); // Serve dist files (including output.css)

// Serve custom file browser UI for /files and all nested paths
app.get('/files', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/file-browser.html'));
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
        // Also filter out files and directories that start with '.'
        const filteredFiles = files.filter(file => 
            file.name !== 'incoming' && 
            file.name !== 'private-files' &&
            !file.name.startsWith('.')
        );

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

app.get("/api/search_feat/file_name=:fileName/current_dir=*", (req: Request, res: Response) => {
    const fileName = req.params.fileName;
    const currentDir = req.params[0] || ''; // 获取通配符匹配的路径部分
    
    if (!fileName) {
        return res.json({error: "file_name parameter is required"});
    }
    
    // 规范化路径，防止路径遍历攻击
    const safeCurrentDir = path.normalize(currentDir).replace(/^(\.\.(\/|\\|$))+/, '');
    const searchPath = path.join(UPLOAD_DIR, safeCurrentDir);
    
    // 确保搜索路径在UPLOAD_DIR内
    if (!searchPath.startsWith(UPLOAD_DIR)) {
        return res.json({error: "Invalid search path"});
    }
    
    try {
        const jsonResult = searchFilesInPath(fileName, searchPath);
        const files = JSON.parse(jsonResult);
        
        // 过滤掉路径前缀为private-files或incoming的文件
        // Also filter out files that start with '.'
        const filteredFiles = files.filter((file: { path: string; full_file_name: string }) => {
            const relativePath = path.relative(UPLOAD_DIR, file.path);
            return !relativePath.startsWith('private-files') && 
                   !relativePath.startsWith('incoming') &&
                   !file.full_file_name.startsWith('.');
        });
        
        // 为每个文件路径拼接UPLOAD_DIR前缀，生成完整路径
        const resultFiles = filteredFiles.map((file: { full_file_name: string; path: string }) => {
            return {
                file_name: file.full_file_name,
                file_path: file.path, // 保持原始完整路径
                relative_path: path.relative(UPLOAD_DIR, file.path) // 添加相对路径信息
            };
        });
        
        console.log(`Found ${resultFiles.length} file(s) matching "${fileName}" in "${safeCurrentDir}":`);
        resultFiles.forEach((file: { file_name: string; file_path: string; relative_path: string }) => {
            console.log(`  - ${file.file_name} (in: ${file.relative_path})`);
        });
        
        return res.json({
            query: {
                file_name: fileName,
                current_dir: safeCurrentDir
            },
            results: resultFiles,
            count: resultFiles.length
        });
    } catch (error) {
        console.error('Search error:', error);
        return res.json({error: "Search failed", details: error instanceof Error ? error.message : "Unknown error"});
    }
})

// Main Page
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// start
app.listen(PORT, HOST, () => {
    console.log(`Server Started: http://${HOST === '0.0.0.0' ? LOCAL_IP : HOST}:${PORT}`);
});
  