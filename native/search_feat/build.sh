#!/bin/bash

echo "Building Node.js addon (.node file)..."

# Install npm dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Build the addon in release mode
echo "Compiling Rust code to .node file..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Find the generated .node file
    NODE_FILE=$(find . -name "*.node" -type f 2>/dev/null | head -1)
    
    if [ -n "$NODE_FILE" ]; then
        echo "📁 Found generated file: $NODE_FILE"
        
        # Create dist directory and move files
        echo "📦 Moving files to dist folder..."
        mkdir -p ../../dist/search_feat
        
        # Move the .node file (keeping original name)
        mv "$NODE_FILE" "../../dist/search_feat/"
        
        # Move the auto-generated bindings
        mv index.js ../../dist/search_feat/
        mv index.d.ts ../../dist/search_feat/
        
        if [ $? -eq 0 ]; then
            echo "✅ Files moved to ../../dist/search_feat/"
            echo "📁 Generated files:"
            ls -la ../../dist/search_feat/
        else
            echo "⚠️  Warning: Could not move some files"
        fi
    else
        echo "⚠️  Warning: No .node file found"
    fi
    
    echo ""
    echo "🚀 You can now use the addon in Node.js:"
    echo "   const addon = require('../../dist/search_feat/index.js');"
    echo "   // The index.js automatically handles platform-specific .node loading"
else
    echo "❌ Build failed!"
    exit 1
fi 