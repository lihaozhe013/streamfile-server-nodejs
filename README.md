# Simple Server NodeJS - TypeScript Version

A simple Express server for file sharing and markdown viewing, now converted to TypeScript.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

Or use the development mode:
```bash
npm run dev
```

## Available Scripts

- `npm start` - Start the server with HOST=0.0.0.0
- `npm run preview` - Start the server with HOST=127.0.0.1
- `npm run build` - Compile TypeScript, build webpack assets, and generate CSS
- `npm run dev` - Build and preview the server
- `npm run build:css` - Watch and build Tailwind CSS

## Project Structure

- `server.ts` - Main server file
- `public/` - Static files
- `uploads/` - Directory for uploaded files
- `dist/` - Compiled TypeScript output

## Features

- File uploading and browsing
- Markdown file viewing
- Directory navigation
- Static file serving

## Introduction
This is a cross-platform, light-weighted web server system, based on Node.js, no database used, support markdown preview.

This system aim to privide a easy way to deploy a server system for files and information provider of an organization.

## How to Setup
### Deployment
1. Clone this repo
2. Run `npm install` to install dependencies
3. Run `npm run build` to bundle markdown dependencies
4. Create a folder called `uploads`, or use `ln -s` symbolic link
5. Run `npm run start` to run
6. Use web browser to visit your ip address + port number

### How to use the server
- You can put files into `/uploads` directory
- Sub-folders are supported in Simple Server
- Secure Link Trick
  > Note: If there's a file called `index.html` in a folder, the server will directly return this page to the user when the user tries to access this folder. You can use this trick to Hide contents inside a folder with a Encrypted file name. Detailed information about this trick can be found [here](#hide-content-trick)
- Supported File Types are listed [here](#supported-file-types)
- Markdown Files Preview
  

### Supported File Types

| File Type        | Support  |
| :--------------- | :------- |
| mp4, mp3         | yes      |
| mkv, mov, avi    | no       |
| pdf              | yes      |
| md               | yes      |
| html             | yes      |
| docx, doc, odt   | no       |

### Secure Link Trick
While Node.js Express will automatically send `index.html` to user when they tries to access a folder that includes `index.html`, you can hide some files or folders with encrypted file/folder name.

A file called `secure-link-generator.html` is provided in this project, you can use it to generate secure url and you can replace your secret file name with a secure file name, for example:

I use `secure-link-generator.html` to generate a link: 
[https://yourdomain.com/secure/B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES](https://yourdomain.com/secure/B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES)

I extract the secure part and rename my file name to
```
B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.md
```

then organize your `uploads` folder like this:

```md
simple-server-nodejs/uploads
├── normal-folder
│   ├── file1
│   ├── file2
├── secure-links
│   ├── index.html
│   ├── B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.md
```

when you try to access the following url:

[https://yourdomain.com/files/secure-links/B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.md](https://yourdomain.com/files/secure-links/B9bx7ZbkDJvxn96I84uwP6RKY5HR1GES.md)

you can access your secure file while people who don't have the link can't reach it.

The same, you can create a secure folder in the same way.

Note that you can edit `index.html` to anything, just make sure to have it in your secure folder. My recommendation is to make `index.html` a warning page, informing users not to access this folder.
