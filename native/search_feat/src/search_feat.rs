use std::path::Path;
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct FileResult {
    pub full_file_name: String,
    pub path: String,
}

pub fn search_files(file_name: &str, search_path: &str) -> Result<Vec<FileResult>, String> {
    let path = Path::new(search_path);
    
    if !path.exists() {
        return Err(format!("Search path '{}' does not exist", search_path));
    }
    
    if !path.is_dir() {
        return Err(format!("Search path '{}' is not a directory", search_path));
    }
    
    let mut results = Vec::new();
    
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Some(entry_file_name) = entry.file_name().to_str() {
                // Check if the file name contains the search term (case-insensitive)
                if entry_file_name.to_lowercase().contains(&file_name.to_lowercase()) {
                    let full_path = entry.path();
                    let parent_path = full_path.parent()
                        .unwrap_or_else(|| Path::new(""))
                        .to_string_lossy()
                        .to_string();
                    
                    results.push(FileResult {
                        full_file_name: entry_file_name.to_string(),
                        path: parent_path,
                    });
                }
            }
        }
    }
    
    Ok(results)
}

pub fn search_files_json(file_name: &str, search_path: &str) -> Result<String, String> {
    let results = search_files(file_name, search_path)?;
    serde_json::to_string(&results).map_err(|e| format!("JSON serialization error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    
    #[test]
    fn test_search_files() {
        // Create a temporary directory structure for testing
        let temp_dir = std::env::temp_dir().join("test_search");
        let _ = fs::create_dir_all(&temp_dir);
        
        // Create some test files
        let test_files = vec![
            "test.txt",
            "example.rs",
            "test_file.json",
            "another.txt",
        ];
        
        for file in &test_files {
            let file_path = temp_dir.join(file);
            let _ = fs::write(file_path, "test content");
        }
        
        // Test the search function
        let results = search_files("test", temp_dir.to_str().unwrap()).unwrap();
        assert!(results.len() >= 2); // Should find test.txt and test_file.json
        
        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
