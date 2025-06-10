const { searchFilesInPath, searchFilesStructured } = require('./index.js');

console.log('Testing Node.js addon file search functionality...\n');

async function runTests() {
    try {
        // Test 1: Search for files containing "rs" in the current directory
        console.log('=== Test 1: Searching for "rs" files in current directory ===');
        const jsonResult = searchFilesInPath('rs', '.');
        console.log('JSON Result:');
        console.log(jsonResult);
        console.log('Parsed JSON:');
        console.log(JSON.parse(jsonResult));
        
        // Test 2: Search for files containing "toml" using structured result
        console.log('\n=== Test 2: Searching for "toml" files (structured result) ===');
        const structuredResult = searchFilesStructured('toml', '.');
        console.log('Structured Result:');
        console.log(structuredResult);
        
        // Test 3: Search for files containing "js" in the current directory
        console.log('\n=== Test 3: Searching for "js" files in current directory ===');
        const jsFiles = searchFilesStructured('js', '.');
        console.log(`Found ${jsFiles.length} file(s):`);
        jsFiles.forEach(file => {
            console.log(`  - File: ${file.fullFileName} in path: ${file.path}`);
        });
        
        // Test 4: Search in a specific subdirectory
        console.log('\n=== Test 4: Searching for "rs" files in src directory ===');
        const srcFiles = searchFilesStructured('rs', './src');
        console.log(`Found ${srcFiles.length} file(s):`);
        srcFiles.forEach(file => {
            console.log(`  - File: ${file.fullFileName} in path: ${file.path}`);
        });
        
        // Test 5: Test error handling with non-existent directory
        console.log('\n=== Test 5: Testing error handling with non-existent directory ===');
        try {
            const errorResult = searchFilesInPath('test', './non_existent_directory');
            console.log('Unexpected success:', errorResult);
        } catch (error) {
            console.log('Expected error caught:', error.message);
        }
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

runTests(); 