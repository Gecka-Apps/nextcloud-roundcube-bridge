import { recommendedJavascript } from '@nextcloud/eslint-config'
import stylistic from '@stylistic/eslint-plugin'
import vue from 'eslint-plugin-vue'

// Reuse the stylistic factory to get the indent rules configured for 2 spaces,
// leaving every other Nextcloud style choice untouched.
const spaceIndent = stylistic.configs.customize({ indent: 2 }).rules

export default [
  {
    ignores: ['js/', 'node_modules/', 'vendor/', 'l10n/'],
  },
  ...recommendedJavascript,
  {
    plugins: { '@stylistic': stylistic, vue },
    rules: {
      // Keep space indentation instead of the Nextcloud standard's tabs.
      '@stylistic/indent': spaceIndent['@stylistic/indent'],
      '@stylistic/indent-binary-ops': spaceIndent['@stylistic/indent-binary-ops'],
      'vue/html-indent': ['error', 2],
      // The build uses ts-loader with "moduleResolution": "node", which rejects
      // explicit .ts extensions in import paths; webpack resolves the
      // extensionless imports natively, so don't require extensions here.
      'import-extensions/extensions': 'off',
    },
  },
]
