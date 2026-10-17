import config from './commitlint.config.mjs'

export default {
  ...config,
  rules: {
    ...config.rules,
    'body-empty': [0],
    'body-min-length': [0],
    'references-empty': [0]
  }
}
