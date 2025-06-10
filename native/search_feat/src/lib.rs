use napi::bindgen_prelude::*;
use napi_derive::napi;

pub mod search_feat;

// Re-export for pure Rust usage
pub use search_feat::{search_files, search_files_json, FileResult};

// Node.js addon API
#[napi]
pub fn search_files_in_path(file_name: String, search_path: String) -> Result<String> {
    search_feat::search_files_json(&file_name, &search_path)
        .map_err(|e| Error::new(Status::GenericFailure, e))
}

#[napi]
pub struct FileSearchResult {
    pub full_file_name: String,
    pub path: String,
}

#[napi]
pub fn search_files_structured(file_name: String, search_path: String) -> Result<Vec<FileSearchResult>> {
    let results = search_feat::search_files(&file_name, &search_path)
        .map_err(|e| Error::new(Status::GenericFailure, e))?;
    
    Ok(results.into_iter().map(|r| FileSearchResult {
        full_file_name: r.full_file_name,
        path: r.path,
    }).collect())
} 