// webpack.config.js
const path = require('path');

module.exports = {
  entry: './src/MarkdownViewer.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'public', 'markdown-viewer'),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  mode: 'development',
};