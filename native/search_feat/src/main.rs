mod search_feat;

fn main() {
    println!("Testing file search functionality...");
    
    // Test 1: Search for files containing "rs" in the current project
    println!("\n=== Test 1: Searching for '.rs' files in current directory ===");
    match search_feat::search_files_json("rs", ".") {
        Ok(json_result) => {
            println!("JSON Result:");
            println!("{}", json_result);
        }
        Err(e) => println!("Error: {}", e),
    }
    
    // Test 2: Search for files containing "toml" in the current directory
    println!("\n=== Test 2: Searching for 'toml' files in current directory ===");
    match search_feat::search_files("toml", ".") {
        Ok(results) => {
            println!("Found {} file(s):", results.len());
            for result in results {
                println!("  - File: {} in path: {}", result.full_file_name, result.path);
            }
        }
        Err(e) => println!("Error: {}", e),
    }
    
    // Test 3: Search for files containing "main" in the src directory
    println!("\n=== Test 3: Searching for 'main' files in src directory ===");
    match search_feat::search_files("main", "./src") {
        Ok(results) => {
            println!("Found {} file(s):", results.len());
            for result in results {
                println!("  - File: {} in path: {}", result.full_file_name, result.path);
            }
        }
        Err(e) => println!("Error: {}", e),
    }
    
    // Test 4: Test with non-existent directory
    println!("\n=== Test 4: Testing with non-existent directory ===");
    match search_feat::search_files("test", "./non_existent_dir") {
        Ok(results) => {
            println!("Found {} file(s):", results.len());
            for result in results {
                println!("  - File: {} in path: {}", result.full_file_name, result.path);
            }
        }
        Err(e) => println!("Expected error: {}", e),
    }
    
    println!("\nTesting completed!");
}
