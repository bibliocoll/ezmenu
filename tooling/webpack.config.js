const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: {
    main: {
      import: './frontend/src/index.ts',
      dependOn: 'common'
    },
    implant: {
      import: './frontend/src/implant.ts',
      dependOn: 'common'
    },
    common: './frontend/src/common/index.ts',
  },
  devServer: {
    static: './dist',
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.ts$/i,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [
          // fallback to style-loader in development
          process.env.NODE_ENV !== "production"
            ? "style-loader"
            : MiniCssExtractPlugin.loader,
          "css-loader",
        ],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // fallback to style-loader in development
          process.env.NODE_ENV !== "production"
            ? "style-loader"
            : MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "sass-loader",
            options: {
              implementation: require("sass"),
              sassOptions: {
                fiber: false,
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[name].css",
      chunkFilename: "[id].css",
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../dist/loggedin'),
  },
  optimization: {
    runtimeChunk: 'single',
    moduleIds: 'deterministic',
    splitChunks: {
      cacheGroups: {
        mmenu: {
          test: /[\\/]node_modules[\\/]mmenu-js/,
          name: 'mmenu',
          chunks: 'all',
       },
      },
      chunks: 'all',
    },
  },
};
