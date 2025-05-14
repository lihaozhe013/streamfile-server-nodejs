# Simple NAS
## Introduction
This is a light-weighted NAS system, based on Node.js express, no database used, support markdown preview

## How to Setup

1. Create a folder called `uploads`, or use `ln -s` symbolic link.
2. Run `npm install` to install dependencies
3. Run `npm run build` to bundle markdown dependencies
4. Run `npm run start` to run
5. Use web browser to visit your ip address + port number

## `npm` parameters

- `npm run build`: build the markdown previewer component developed by react.js
- `npm run preview`: run this program on localhost
- `npm run dev`: a combination of `npm run build` and `npm run preview`, build and run in one command
- `npm run start`: start the server on 0.0.0.0

## Changelog
#### v1.1.2
- Updated the UI
- Now provide all `npm run` commands, details are in [`npm` parameters](#npm-parameters)

#### v1.1.1
- Updated the UI, looks prettier
  - Updated index.html, use cross-platform friendly fonts and improved the appearance of fieldset
  - Updated markdown previewer's react component, improved the appearance of `note:` component

#### v1.1.0
- Implemented markdown preview feature

#### v1.0.0
- First Version
- Implemented upload feature, user can upload files to `uploads/new_upload_things`
- Implemented online video player feature
