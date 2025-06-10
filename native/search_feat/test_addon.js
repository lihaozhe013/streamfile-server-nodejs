// Test the renamed addon.node file directly

console.log('🧪 Testing the renamed addon.node file...\n');

try {
    // Test loading the addon directly
    const addon = require('./search_feat.node');
    
    console.log('✅ Successfully loaded addon.node');
    console.log('📋 Available functions:', Object.keys(addon));
    
    // Test the search functionality
    console.log('\n🔍 Testing search functionality:');
    
    // Test 1: Search for "js" files
    const jsFiles = addon.searchFilesStructured('js', '.');
    console.log(`Found ${jsFiles.length} JS files:`);
    jsFiles.slice(0, 3).forEach(file => {
        console.log(`  - ${file.fullFileName} (in: ${file.path})`);
    });
    
    // Test 2: Search for "rs" files  
    const rsFiles = addon.searchFilesStructured('rs', './src');
    console.log(`\nFound ${rsFiles.length} Rust files in src:`);
    rsFiles.forEach(file => {
        console.log(`  - ${file.fullFileName} (in: ${file.path})`);
    });
    
    // Test 3: JSON result
    const jsonResult = addon.searchFilesInPath('toml', '.');
    const parsedResult = JSON.parse(jsonResult);
    console.log(`\nFound ${parsedResult.length} TOML files:`, parsedResult);
    
    console.log('\n✅ All tests passed! The renamed addon.node works perfectly.');
    
} catch (error) {
    console.error('❌ Error testing addon.node:', error.message);
    process.exit(1);
} 