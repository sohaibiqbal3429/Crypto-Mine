const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')

const config = {
  transformer: {
    unstable_allowRequireContext: true
  },
  resolver: {
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json']
  }
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
