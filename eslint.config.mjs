/**
 * ESLint configuration for the Discord Notification Feed
 * Sets up linting rules for JavaScript and React code
 */

import eslint from '@electron-toolkit/eslint-config'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default [
  // Ignore non-project files
  { ignores: ['**/node_modules', '**/dist', '**/out'] },

  // Base electron configuration
  eslint,

  // React configurations
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],

  // React version detection
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },

  // React-specific rules and plugins
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      // Enable React Hooks rules
      ...eslintPluginReactHooks.configs.recommended.rules,
      // Enable Fast Refresh support
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },

  // Prettier compatibility
  eslintConfigPrettier
]
