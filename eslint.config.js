import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'node/prefer-global/process': 'off',
    'no-console': 'off',
    'no-new': 'off',
    'antfu/if-newline': 'off'
  },
})
