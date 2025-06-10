// Simple usage example for the file search Node.js addon

const { searchFilesInPath, searchFilesStructured } = require('./index.js');

console.log('🔍 File Search Node.js Addon Example\n');

// Example 1: Search for JavaScript files and get JSON result
console.log('📁 Searching for "js" files in current directory:');
try {
    const jsonResult = searchFilesInPath('js', '.');
    const files = JSON.parse(jsonResult);
    console.log(`Found ${files.length} file(s):`);
    files.forEach(file => {
        console.log(`  - ${file.full_file_name} (in: ${file.path})`);
    });
} catch (error) {
    console.log('Error:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// Example 2: Search for Rust files and get structured result
console.log('🦀 Searching for "rs" files in src directory:');
try {
    const rustFiles = searchFilesStructured('rs', './src');
    console.log(`Found ${rustFiles.length} Rust file(s):`);
    rustFiles.forEach(file => {
        console.log(`  - ${file.fullFileName} (in: ${file.path})`);
    });
} catch (error) {
    console.log('Error:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// Example 3: Search in a specific directory
console.log('📂 Searching for "toml" files in current directory:');
try {
    const configFiles = searchFilesStructured('toml', '.');
    if (configFiles.length > 0) {
        console.log('Configuration files found:');
        configFiles.forEach(file => {
            console.log(`  - ${file.fullFileName} (in: ${file.path})`);
        });
    } else {
        console.log('No configuration files found.');
    }
} catch (error) {
    console.log('Error:', error.message);
}

console.log('\n✨ Example completed!'); 