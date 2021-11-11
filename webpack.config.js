const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
const devMode = process.env.NODE_ENV === 'development';
console.log(`NODE_ENV is: "${process.env.NODE_ENV}", devMode is: "${devMode}"`)
module.exports = {
  entry: {
    injectmenu: {
      import: './frontend/src/index.ts',
//      dependOn: 'common'
    },
    implant: {
      import: './frontend/src/implant.ts',
//      dependOn: 'common'
    },
//    common: './frontend/src/common/index.ts',
    coll: {
      import: './frontend/sass/public/coll.sass'
    }
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, './demo/'),
    }
 },
  devtool:  devMode ? 'inline-source-map' : 'source-map',
  module: {
    rules: [
      { // pictures
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      { // fonts
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      { // typescript
        test: /\.ts$/i,
        use: 'ts-loader',
//        exclude: /node_modules/,
      },
      { // (plain) css. loader pipeline is traversed bottom-to-top (css -> style/extract)
        test: /\.css$/i,
        use: [
          // fallback to style-loader in development
          devMode
            ? "style-loader"
            : MiniCssExtractPlugin.loader,
          "css-loader",
        ],
      },
      { // sass. loader pipeline is traversed bottom-to-top (sass -> css -> style/extract)
        test: /\.s[ac]ss$/i,
        use: [
          // fallback to style-loader in development
          devMode
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
  plugins: [].concat(devMode ? [
//    new HtmlWebpackPlugin()
  ] : [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      // filename: "public/[name].css",
      // chunkFilename: "public/[id].css",
      filename: (pathData) => pathData.chunk.name === 'coll' ? 'public/[name].css' : 'loggedin/[name].css',
      chunkFilename: (pathData) => pathData.chunk.name === 'coll' ? 'public/[id].css' : 'loggedin/[id].css',
    }),
    new CopyPlugin({
      patterns: [
        // { from: path.posix.join(path.resolve(__dirname, '../frontend/html/'), '**/*.htm'), to: path.resolve(__dirname,'../dist/') },
        { from: '**/*.htm', to: path.resolve(__dirname, './dist/'), context: './frontend/html/' },
      ],
    }),
  ]),
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: (pathData) => pathData.chunk.name === 'coll' ? 'public/[name].js' : 'loggedin/[name].js',
    assetModuleFilename: "public/[name][ext]",
    hashFunction: "xxhash64",
    path: devMode ? path.resolve(__dirname, './demo/') : path.resolve(__dirname, './dist/'),
    clean: !devMode
  },
  optimization: {
    runtimeChunk: false, // 'single' would shave off 7kb, but I prefer injecting only one script file
    moduleIds: 'deterministic',
    // splitChunks: {
    //   cacheGroups: {
    //     mmenu: {
    //       test: /[\\/]node_modules[\\/]mmenu-js[\\/]/,
    //       name: 'mmenu',
    //       chunks: 'all',
    //    },
    //   },
    //   chunks: 'all',
    // },
  },
  experiments: {
    futureDefaults: true,
  }
};

