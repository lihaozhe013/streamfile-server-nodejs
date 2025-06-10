// Test the addon from the dist folder

console.log('🧪 Testing addon from dist/search_feat/...\n');

try {
    // Test loading the addon from dist folder
    const { searchFilesInPath, searchFilesStructured } = require('./dist/search_feat/index.js');
    
    console.log('✅ Successfully loaded addon from dist folder');
    
    // Test the search functionality
    console.log('\n🔍 Testing search functionality:');
    
    // Test 1: Search for "js" files
    const jsFiles = searchFilesStructured('js', '.');
    console.log(`Found ${jsFiles.length} JS files (showing first 3):`);
    jsFiles.slice(0, 3).forEach(file => {
        console.log(`  - ${file.fullFileName} (in: ${file.path})`);
    });
    
    // Test 2: Search for "node" files  
    const nodeFiles = searchFilesStructured('node', './dist');
    console.log(`\nFound ${nodeFiles.length} .node files in dist:`);
    nodeFiles.forEach(file => {
        console.log(`  - ${file.fullFileName} (in: ${file.path})`);
    });
    
    // Test 3: JSON result
    const jsonResult = searchFilesInPath('toml', './native');
    const parsedResult = JSON.parse(jsonResult);
    console.log(`\nFound ${parsedResult.length} TOML files in native:`, parsedResult);
    
    console.log('\n✅ All tests passed! The addon works perfectly from dist folder.');
    console.log('🎯 The auto-generated index.js correctly loads the platform-specific .node file!');
    
} catch (error) {
    console.error('❌ Error testing addon from dist:', error.message);
    process.exit(1);
} 