# Simple Server NodeJS

A lightweight, cross-platform web server built with Node.js and TypeScript for file sharing, markdown viewing, and secure file management. Perfect for organizations needing a simple file server with no database requirements.

## ✨ Features

- 📁 **File Upload & Management** - Easy drag-and-drop file uploads
- 📝 **Markdown Preview** - Real-time markdown rendering with KaTeX math support
- 🔒 **Private File Access** - Secure file sharing via direct URLs
- 📂 **Directory Navigation** - Intuitive file browser interface
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- 🔐 **Access Control** - Multiple security levels for different file types
- 🌐 **Cross-Platform** - Works on Windows, macOS, and Linux

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd simple-server-nodejs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access your server**
   - Open your browser and go to `http://localhost:8000`
   - Or access from other devices using your local IP address

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server on all interfaces (0.0.0.0) |
| `npm run preview` | Start server on localhost only (127.0.0.1) |
| `npm run build` | Full build (TypeScript + Webpack + CSS) |
| `npm run build:ts` | Compile TypeScript only |
| `npm run build:css` | Build and watch Tailwind CSS |
| `npm run dev` | Build TypeScript and start preview |
| `npm run dev:all` | Full build and start server |

## 📁 Directory Structure

```
simple-server-nodejs/
├── server.ts              # Main server file
├── public/                # Static web assets
│   ├── file-browser/      # File browser UI
│   ├── markdown-viewer/   # Markdown preview components
│   └── index.html         # Main page
├── uploads/               # File storage directory
│   ├── incoming/          # Upload staging (hidden from web)
│   ├── private-files/     # Private files (URL access only)
│   └── [your files...]    # Public files and folders
└── dist/                  # Compiled TypeScript output
```

## 🔐 File Access Levels

### 1. **Public Files** (`uploads/`)
- ✅ Visible in file browser
- ✅ Accessible via web interface
- ✅ Can be browsed and downloaded by anyone

### 2. **Private Files** (`uploads/private-files/`)
- ❌ Hidden from file browser
- ✅ Accessible via direct URL if known
- 🔗 Perfect for sharing specific files with direct links
- **Example**: `http://yourserver:8000/private-files/secret-folder/document.pdf`

### 3. **Incoming Files** (`uploads/incoming/`)
- ❌ Completely hidden from web access
- ❌ Not accessible via any URL
- 📤 Used for file upload staging
- 🔒 Maximum security for sensitive uploads

## 📝 Supported File Types

| Category | File Types | Preview Support |
|----------|------------|-----------------|
| **Documents** | `.md`, `.html`, `.pdf` | ✅ Markdown, ✅ HTML, ✅ PDF |
| **Media** | `.mp4`, `.mp3`, `.jpg`, `.png`, `.gif` | ✅ Native browser support |
| **Archives** | `.zip`, `.tar`, `.gz` | ❌ Download only |
| **Office** | `.docx`, `.xlsx`, `.pptx` | ❌ Download only |
| **Code** | `.js`, `.ts`, `.py`, `.css`, etc. | ✅ Syntax highlighting |

### Special Features
- **Markdown Files**: Full preview with KaTeX math rendering, GitHub Flavored Markdown
- **Directory Index**: Automatic `index.html` serving for folders
- **Chinese Characters**: Full support for Unicode filenames

## 🔒 Security Features

### Secure Link Generation
Create secure, hard-to-guess URLs for sensitive files:

1. Use the built-in secure link generator (if available)
2. Generate a secure filename: `B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES`
3. Rename your file: `secret-document.pdf` → `B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.pdf`
4. Place in `uploads/private-files/`
5. Share the direct URL: `http://yourserver:8000/private-files/B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.pdf`

### Access Control Best Practices
- Use `private-files/` for confidential documents
- Create `index.html` warning pages in sensitive directories
- Use secure, random filenames for sensitive content
- Regularly audit file permissions and access logs

## 🛠️ Configuration

### Environment Variables
- `HOST` - Server host (default: `0.0.0.0`)
- `PORT` - Server port (default: `8000`)

### Custom Setup
```bash
# Start on specific host/port
HOST=192.168.1.100 PORT=3000 npm start

# Development with custom settings
HOST=localhost PORT=8080 npm run dev
```

## 🌐 Network Access

### Local Network Sharing
1. Find your local IP address
2. Ensure firewall allows connections on your chosen port
3. Share the URL: `http://[YOUR-IP]:8000`

### Security Considerations
- The server binds to `0.0.0.0` by default (accessible from network)
- Use `npm run preview` for localhost-only access
- Consider using a reverse proxy (nginx) for production
- Implement additional authentication if needed

## 🔧 Development

### Building Components
```bash
# Watch CSS changes
npm run build:css

# Rebuild everything
npm run build

# Development mode
npm run dev:all
```

### Project Architecture
- **Backend**: Express.js with TypeScript
- **Frontend**: React components with Tailwind CSS
- **Build Tools**: Webpack, Babel, TypeScript compiler
- **File Handling**: Multer for uploads, serve-static for delivery

## 📚 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application page |
| `/files` | GET | File browser interface |
| `/files/*` | GET | Access public files and folders |
| `/private-files/*` | GET | Access private files by direct URL |
| `/api/list-files` | GET | Get directory contents (JSON) |
| `/upload` | POST | Upload files to incoming directory |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push and create a Pull Request

## 📄 License

This project is open source. Please check the license file for details.

## 🆘 Troubleshooting

### Common Issues

**Server won't start**
- Check if port 8000 is already in use
- Try a different port: `PORT=3000 npm start`

**Files not uploading**
- Ensure `uploads/incoming/` directory exists and is writable
- Check file size limits in your system

**Can't access from other devices**
- Verify firewall settings
- Use `npm start` (not `npm run preview`)
- Check your local IP address

**Markdown not rendering**
- Ensure webpack build completed successfully: `npm run build`
- Check browser console for JavaScript errors

---

**Version**: 2.0.0 | **Author**: lihaozhe | **Built with**: Node.js, TypeScript, Express, React
