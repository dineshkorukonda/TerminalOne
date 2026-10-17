import { extname, relative, sep } from 'node:path'

export default (files) => {
  const paths = files
    .map((file) => relative(process.cwd(), file).split(sep).join('/'))
    .filter(
      (file) =>
        !/^(?:website|node_modules|out|test-results|playwright-report)\//u.test(
          file
        )
    )
    .filter(
      (file) =>
        file !== 'package-lock.json' && file !== '.github/workflows/website.yml'
    )
  // lint-staged parses arguments without a shell; JSON quoting preserves spaces.
  const quote = (list) => list.map((file) => JSON.stringify(file)).join(' ')
  const code = paths.filter((file) => /\.(?:[cm]?js|tsx?)$/u.test(file))
  const formatted = paths.filter((file) =>
    [
      '.js',
      '.mjs',
      '.cjs',
      '.ts',
      '.tsx',
      '.json',
      '.md',
      '.yml',
      '.yaml',
      '.css',
      '.html'
    ].includes(extname(file))
  )
  return [
    ...(code.length ? [`eslint --max-warnings 0 ${quote(code)}`] : []),
    ...(formatted.length ? [`prettier --check ${quote(formatted)}`] : [])
  ]
}
