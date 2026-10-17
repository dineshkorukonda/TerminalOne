export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-empty': [2, 'never'],
    'body-min-length': [2, 'always', 20],
    'body-max-line-length': [0],
    'references-empty': [2, 'never'],
    'no-emoji': [2, 'always']
  },
  plugins: [
    {
      rules: {
        'no-emoji': ({ raw }) => [
          !/[\p{Extended_Pictographic}\uFE0F]/u.test(raw),
          'Commit messages must not contain emoji'
        ]
      }
    }
  ]
}
