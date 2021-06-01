const path = require('path');
const webpack = require('webpack');
const CompressionPlugin = require('compression-webpack-plugin');
const ClosureCompilerPlugin = require('webpack-closure-compiler');
const { StatsWriterPlugin } = require('webpack-stats-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const ShakePlugin = require('webpack-common-shake').Plugin;
const TerserPlugin = require('terser-webpack-plugin');

const { GenerateSW } = require('workbox-webpack-plugin');

const rollupPluginNodeResolve = require('rollup-plugin-node-resolve');

const prod = process.env.NODE_ENV == 'production';
const dev = !prod && process.env.DEV !== '0';
const analyze = process.env.NODE_ENV == 'analyze';
const useRollup = process.env.ROLLUP == '1';
const useShakePlugin = prod || process.env.SHAKE == '1';
const useClosureCompiler = process.env.CLOSURE === '1';

let publicUrl = '';

module.exports = {
  mode: dev ? 'development' : 'production',
  context: __dirname,
  entry: useRollup ? './lib/es6/src/index.bs' : './lib/js/src/index.bs',
  output: {
    filename: '[name].js',
    path: path.join(__dirname, './dist/build'),
    publicPath: '/build/'
  },
  devServer: {
    contentBase: path.resolve(__dirname, 'public'),
    historyApiFallback: true
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src/'),
      director: 'director/build/director'
    },
    modules: [
      'node_modules',
      /**
       * bs-platform doesn't resolve dependencies of linked packages
       * correctly: https://github.com/BuckleScript/bucklescript/issues/1691
       *
       * To workaround, directly include the linked package node_modules
       * in our resolution search path.
       */
      path.resolve(__dirname, '../@rescript/react/node_modules')
    ]
  },
  module: {
    rules: [
      {
        test: /\.png$/,
        loader: 'file-loader'
      },
      {
        test: /\.css$/,
        use: [ { loader: 'style-loader' }, { loader: 'css-loader' } ]
      },
      useRollup
        ? {
            test: /\.js$/,
            loader: 'rollup-loader',
            options: {
              plugins: [ rollupPluginNodeResolve({ module: true }) ]
            }
          }
        : null
    ].filter(Boolean)
  },
  // node: {
  //   fs: 'empty',
  //   net: 'empty',
  //   tls: 'empty',
  // },
  // prod ? optimization: {
  //   minimize: true,
  //   minimizer: [new TerserPlugin({
  //       extractComments: comments: /^\**!|^ [0-9]+ $|@preserve|@license/,
  //     })],
  // } : null,
  // optimization: {
  //   minimize: true,
  //   minimizer: [new TerserPlugin()],
  // },
  plugins: [
    // Generate a service worker script that will precache, and keep up to date,
    // the HTML & assets that are part of the Webpack build.
    new GenerateSW({
      // By default, a cache-busting query parameter is appended to requests
      // used to populate the caches, to ensure the responses are fresh.
      // If a URL is already hashed by Webpack, then there is no concern
      // about it being stale, and the cache-busting can be skipped.
      // dontCacheBustUrlsMatching: /\.\w{8}\./,
      // filename: 'service-worker.js',
      // minify: prod || analyze,
      navigateFallback: publicUrl + '/index.html',
      exclude: [ /\.map$/, /asset-manifest\.json$/ ]
    }),

    // Generate a manifest file which contains a mapping of all asset filenames
    // to their corresponding output file so that tools can pick it up without
    // having to parse `index.html`.
    // new InjectManifest({
    //   swSrc: 'asset-manifest.json',
    // }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(!dev ? 'production' : 'development'),
        PUBLIC_URL: JSON.stringify(publicUrl + '/build')
      }
    }),
    useClosureCompiler
      ? new ClosureCompilerPlugin({
          compiler: {
            language_in: 'ECMASCRIPT6',
            language_out: 'ECMASCRIPT5'
          },
          concurrency: 3
        })
      : null,
    prod ? new TerserPlugin() : null,
    analyze
      ? prod
        ? optimization
        : {
            minimize: true,
            minimizer: [
              new TerserPlugin({
                extractComments: /^\**!|^ [0-9]+ $|@preserve|@license/,
                terserOptions: {
                  compress: {
                    warnings: false
                  }
                }
              })
            ]
          }
      : null,
    true
      ? new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css)$/,
          threshold: 10240,
          minRatio: 0.8
        })
      : null,
    true
      ? new StatsWriterPlugin({
          filename: 'stats.json',
          fields: null,
          transform: function(data) {
            data.modules.forEach(function(m) {
              delete m.source;
            });
            delete data.children;
            return JSON.stringify(data, null, 2);
          }
        })
      : null,
    useShakePlugin ? new ShakePlugin() : null
  ].filter(Boolean)
};
