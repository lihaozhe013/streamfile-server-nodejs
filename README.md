# StreamFile Server NodeJS

## Introduction

A lightweight, cross-platform web server built with Node.js for file sharing, markdown viewing, and secure file management. Perfect for organizations needing a simple file server with no database requirements.

## Quick Start

### Docker

Use the following `compose.yaml` to quick start the server

```yaml
services:
  app:
    image: lihaozhe013/streamfile-server:latest
    container_name: streamfile-server-instance
    volumes:
      - ./config.yaml:/app/config.yaml
      - ./files:/app/files
    ports:
      - '3000:3000'
    command: node server.js
```

### Prerequisites

- Node.js (v24 or higher)
- npm

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/lihaozhe013/streamfile-server-nodejs.git
cd streamfile-server-nodejs
```

2. **Install dependencies**

```bash
npm run install:all
```

### Dev

1. **Build the project**

```bash
npm run build
```

2. **Start the server**

```bash
cd dist && node server.js
```

3. **Access your server**

- Open your browser and go to `http://your-ip-address:3000`
- Or access from other devices using your local IP address

## File Access Levels

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

## Supported File Types

| Category      | File Types                             | Preview Support              |
| ------------- | -------------------------------------- | ---------------------------- |
| **Documents** | `.md`, `.html`, `.pdf`                 | ✅ Markdown, ✅ HTML, ✅ PDF |
| **Media**     | `.mp4`, `.mp3`, `.jpg`, `.png`, `.gif` | ✅ Video.js + Native Browser Support    |
| **Archives**  | `.zip`, `.tar`, `.gz`                  | ❌ Download only             |
| **Office**    | `.docx`, `.xlsx`, `.pptx`              | ❌ Download only             |
| **Code**      | `.js`, `.ts`, `.py`, `.css`, etc.      | ✅ Syntax highlighting       |

### Special Features

- **Markdown Files**: Full preview with KaTeX math rendering, GitHub Flavored Markdown
- **Directory Index**: Automatic `index.html` serving for folders
- **Chinese Characters**: Full support for Unicode filenames

## Security Features

### Secure Link Generation

Create secure, hard-to-guess URLs for sensitive files:

1. Use the built-in secure link generator (if available)
2. Generate a secure filename: `B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES`
3. Rename your file: `secret-document.pdf` → `B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.pdf`
4. Place in `files/private-files/`
5. Share the direct URL: `http://yourserver:8000/private-files/B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.pdf`

## Configuration

You can customize the configuration in `config.yaml`.

```bash
cp config.yaml.example config.yaml
```
