import { fileURLToPath } from 'node:url'
import parser from '@typescript-eslint/parser'
import { importX } from 'eslint-plugin-import-x'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'

const root = fileURLToPath(new URL('.', import.meta.url))
const layers = {
  domain: ['domain'],
  application: ['application', 'domain'],
  infrastructure: ['infrastructure', 'application', 'domain'],
  main: ['main', 'infrastructure', 'application', 'domain'],
  preload: ['preload'],
  renderer: ['renderer']
}

export default [
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'test-results/**',
      'playwright-report/**',
      'website/**'
    ]
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['tsconfig.node.json', 'tsconfig.web.json'],
          noWarnOnMultipleProjects: true
        })
      ]
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'Source modules must belong to a documented architecture layer.'
        }
      ],
      'import-x/no-unresolved': ['error', { ignore: ['\\.css$'] }],
      'import-x/no-absolute-path': 'error',
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: root,
          zones: [
            ...Object.entries(layers).map(([layer, allowed]) => ({
              target: `./src/${layer}`,
              from: '.',
              except: [
                ...allowed.map((dependency) => `src/${dependency}`),
                ...(['domain', 'application'].includes(layer)
                  ? []
                  : ['node_modules'])
              ],
              message: `${layer} may import only ${allowed.join(', ')} source modules.`
            })),
            {
              target: './src/renderer',
              from: './node_modules/electron',
              message: 'Electron belongs behind the preload boundary.'
            },
            {
              target: ['./src/main', './src/infrastructure'],
              from: ['./node_modules/react', './node_modules/react-dom'],
              message: 'React belongs in the renderer.'
            }
          ]
        }
      ]
    }
  },
  {
    files: [`src/{${Object.keys(layers).join(',')}}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.type!="Literal"]',
          message:
            'Use a literal module specifier so architecture imports can be checked.'
        },
        {
          selector: 'CallExpression[callee.name="require"]',
          message:
            'Use ES module imports so architecture imports can be checked.'
        },
        {
          selector: 'TSImportEqualsDeclaration',
          message:
            'Use ES module imports so architecture imports can be checked.'
        },
        {
          selector: 'TSImportType',
          message:
            'Use a named import type so architecture imports can be checked.'
        }
      ]
    }
  },
  {
    files: ['src/{domain,application}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        'process',
        'Buffer',
        '__dirname',
        '__filename',
        'global',
        'setImmediate',
        'clearImmediate'
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/)',
              message:
                'Core modules use relative imports and must not depend on platform or third-party packages.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/{domain,application,renderer,preload}/**/*.{ts,tsx}'],
    rules: {
      'import-x/no-nodejs-modules': 'error'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message:
                'Renderer code cannot import Electron; use the preload capability boundary.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/preload/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Use static ES module imports in the sandboxed preload.'
        },
        {
          selector: 'CallExpression[callee.name="require"]',
          message: 'Use static ES module imports in the sandboxed preload.'
        },
        {
          selector: 'TSImportEqualsDeclaration',
          message: 'Use static ES module imports in the sandboxed preload.'
        },
        {
          selector: 'TSImportType',
          message:
            'Use a named import type so architecture imports can be checked.'
        }
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/|electron$)',
              message:
                'Sandboxed preload imports only its own modules and Electron.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/{main,infrastructure}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'React belongs in the renderer.'
            }
          ]
        }
      ]
    }
  }
]
