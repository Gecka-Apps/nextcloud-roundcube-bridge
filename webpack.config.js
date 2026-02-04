const path = require('path')
const webpackConfig = require('@nextcloud/webpack-vue-config')

module.exports = {
  ...webpackConfig,
  entry: {
    main: path.resolve(__dirname, 'src', 'main.ts'),
    admin: path.resolve(__dirname, 'src', 'admin.ts'),
  },
  output: {
    ...webpackConfig.output,
    // Auto-detect public path from loaded script URL
    // Works regardless of Nextcloud's subdirectory installation
    publicPath: 'auto',
  },
  resolve: {
    ...webpackConfig.resolve,
    extensions: ['.tsx', '.ts', '.js', '.vue'],
  },
}
