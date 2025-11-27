const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure resolver for better CommonJS/ESM interop on web
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Add resolution for tslib specifically for web platform
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // For web platform, ensure tslib resolves to the ESM-compatible version
  if (platform === 'web' && moduleName === 'tslib') {
    return {
      filePath: require.resolve('tslib'),
      type: 'sourceFile',
    };
  }
  
  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
