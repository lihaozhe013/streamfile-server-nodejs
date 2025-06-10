# File Search - Usage Guide

This project provides both a pure Rust library and a Node.js native addon for high-performance file searching.

## 🦀 Pure Rust Usage

### Running the Test Application
```bash
cargo run --bin file_search_test
```

### Running Unit Tests
```bash
cargo test
```

### Using as a Rust Library
```rust
use file_search_rust::{search_files, search_files_json, FileResult};

// Search for files and get structured results
let results = search_files("rs", "./src").unwrap();
for file in results {
    println!("Found: {} in {}", file.full_file_name, file.path);
}

// Search for files and get JSON string
let json_result = search_files_json("toml", ".").unwrap();
println!("JSON: {}", json_result);
```

## 🌐 Node.js Addon Usage

### Building the .node File

**On Windows (Git Bash/MSYS2):**
```bash
./build.sh
```

**On Windows (Command Prompt):**
```cmd
build.bat
```

**Manual build:**
```bash
npm install
npm run build
```

### Using the Node.js Addon

```javascript
// Option 1: Use the auto-generated index.js (recommended)
const { searchFilesInPath, searchFilesStructured } = require('./index.js');

// Option 2: Use the addon.node file directly
const { searchFilesInPath, searchFilesStructured } = require('./addon.node');

// Method 1: Get JSON string result
const jsonResult = searchFilesInPath('js', '.');
const files = JSON.parse(jsonResult);
console.log('Found files:', files);

// Method 2: Get structured object array
const structuredResult = searchFilesStructured('rs', './src');
structuredResult.forEach(file => {
    console.log(`File: ${file.fullFileName} in ${file.path}`);
});
```

### Running Examples

```bash
# Run the comprehensive test suite
node test.js

# Run the simple usage example
node example.js
```

## 📋 API Reference

### Rust API

#### `search_files(file_name: &str, search_path: &str) -> Result<Vec<FileResult>, String>`
- **Parameters:**
  - `file_name`: Filename or partial filename to search for (case-insensitive)
  - `search_path`: Directory path to search in (recursive)
- **Returns:** Vector of `FileResult` structs or error message

#### `search_files_json(file_name: &str, search_path: &str) -> Result<String, String>`
- **Parameters:** Same as above
- **Returns:** JSON string or error message

#### `FileResult` struct:
```rust
pub struct FileResult {
    pub full_file_name: String,
    pub path: String,
}
```

### Node.js API

#### `searchFilesInPath(fileName: string, searchPath: string) -> string`
- **Parameters:**
  - `fileName`: Filename or partial filename to search for (case-insensitive)
  - `searchPath`: Directory path to search in (recursive)
- **Returns:** JSON string with search results
- **Throws:** Error if search fails

#### `searchFilesStructured(fileName: string, searchPath: string) -> FileSearchResult[]`
- **Parameters:** Same as above
- **Returns:** Array of `FileSearchResult` objects
- **Throws:** Error if search fails

#### `FileSearchResult` object:
```typescript
interface FileSearchResult {
    fullFileName: string;
    path: string;
}
```

## 🔧 Build Requirements

### For Rust Development
- Rust (latest stable)
- Cargo

### For Node.js Addon
- Node.js (v14+)
- npm
- Rust toolchain
- Platform-specific build tools:
  - **Windows:** Visual Studio Build Tools with C++ workload
  - **macOS:** Xcode Command Line Tools
  - **Linux:** build-essential package

## 📁 Generated Files

After building the Node.js addon, you'll find:
- `addon.node` (the compiled native addon - renamed for consistency across platforms)
- `index.js` (auto-generated Node.js binding)
- `index.d.ts` (TypeScript definitions)

## 🚀 Performance

This implementation uses Rust's `walkdir` crate for efficient directory traversal, providing excellent performance for:
- Large directory structures
- Recursive file searching
- Cross-platform file system operations

## ⚠️ Error Handling

Both APIs handle common errors:
- Non-existent search paths
- Invalid directory paths
- Permission issues
- File system access errors

## 📝 Examples

See the included files:
- `test.js` - Comprehensive test suite
- `example.js` - Simple usage examples
- `src/main.rs` - Rust usage examples 