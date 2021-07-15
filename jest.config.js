module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  testEnvironment: 'node',
  testRegex: '/tests/.*\\.(test|spec)?\\.(ts)$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
