# Simple Server NodeJS
A lightweight, cross-platform web server built with Node.js for file sharing, markdown viewing, and secure file management. Perfect for organizations needing a simple file server with no database requirements.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lihaozhe013/simple-server-nodejs.git
   cd simple-server-nodejs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

   > This project may require the installation of the rust compiler and Node.js (>=14)

3. **Build the project**
   ```bash
   npm run build:all
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access your server**
   - Open your browser and go to `http://localhost:80`
   - Or access from other devices using your local IP address

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server on all interfaces (0.0.0.0) |
| `npm run preview` | Start server on localhost only (127.0.0.1) |
| `npm run build` | Node Full build (TypeScript + Webpack + CSS) |
| `npm run build:all` | Full build (TypeScript + Webpack + CSS) + Native Addons |
| `npm run build:server` | Compile Server only |
| `npm run build:frontend` | Compile Frontend only |
| `npm run build:css` | Build and watch Tailwind CSS |
| `npm run dev:server` | Build Server and start preview |
| `npm run dev` | Full build and start server |

## 📁 Directory Structure

```
simple-server-nodejs/
├── src/
│   ├── server.ts          # Main server file
├── public/                # Static web assets
│   ├── file-browser/      # File browser UI
│   ├── markdown-viewer/   # Markdown preview components
│   └── index.html         # Main page
├── files/               # File storage directory
│   ├── incoming/          # Upload staging (hidden from web)
│   ├── private-files/     # Private files (URL access only)
│   └── [your files...]    # Public files and folders
└── dist/                  # Compiled TypeScript and Native Addon output
```

## 🔐 File Access Levels

### 1. **Public Files** (`files/`)

- ✅ Visible in file browser
- ✅ Accessible via web interface
- ✅ Can be browsed and downloaded by anyone

### 2. **Private Files** (`files/private-files/`)
- ❌ Hidden from file browser
- ✅ Accessible via direct URL if known
- 🔗 Perfect for sharing specific files with direct links
- **Example**: `http://yourserver:8000/private-files/secret-folder/document.pdf`

### 3. **Incoming Files** (`files/incoming/`)
- ❌ Completely hidden from web access
- ❌ Not accessible via any URL
- 📤 Used for file upload staging
- 🔒 Maximum security for sensitive files

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
4. Place in `files/private-files/`
5. Share the direct URL: `http://yourserver:8000/private-files/B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.pdf`

## 🛠️ Configuration

### Environment Variables
- `HOST` - Server host (default: `0.0.0.0`)
- `PORT` - Server port (default: `8000`)

### Custom Setup
```bash
# Start on specific host/port
HOST=192.168.1.100 PORT=80 npm start

# Development with custom settings
HOST=localhost PORT=80 npm run dev
```

## 🌐 Network Access

### Local Network Sharing
1. Find your local IP address
2. Ensure firewall allows connections on your chosen port
3. Share the URL: `http://[YOUR-IP]:80`

### Security Considerations
- The server binds to `0.0.0.0` by default (accessible from network)
- Use `npm run preview` for localhost-only access
- Consider using a reverse proxy (nginx) for production
- Implement additional authentication if needed
