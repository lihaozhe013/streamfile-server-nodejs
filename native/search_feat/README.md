# File Search - Rust Library

A high-performance file searching library written in Rust for searching files by name within a given directory path.

## Features

- Fast file searching using Rust's performance
- Recursive directory traversal
- Case-insensitive filename matching
- Returns results in JSON format or structured objects
- Cross-platform support (Windows, macOS, Linux)

## Prerequisites

- Rust (latest stable version)
- Cargo

## Usage

### Running the Test Application

```bash
cargo run
```

### Running Tests

```bash
cargo test
```

## API

The library provides these main functions:

### `search_files(file_name: &str, search_path: &str) -> Result<Vec<FileResult>, String>`
Returns a vector of `FileResult` structs.

### `search_files_json(file_name: &str, search_path: &str) -> Result<String, String>`
Returns a JSON string with search results.

### Parameters
- `file_name` (string): The filename or partial filename to search for (case-insensitive)
- `search_path` (string): The directory path to search in (searches recursively)

### Return Format
Each result contains:
- `full_file_name`: The complete filename
- `path`: The directory path where the file is located

### Example Output
```json
[
  {
    "full_file_name": "test.txt",
    "path": "/home/user/documents"
  },
  {
    "full_file_name": "test_file.rs",
    "path": "/home/user/documents/src"
  }
]
```

## Error Handling

The library will return errors for:
- Non-existent search paths
- Invalid directory paths
- Permission issues

## Performance

This library uses Rust's `walkdir` crate for efficient directory traversal and provides excellent performance for large directory structures.

## License

MIT 