const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Workspace SDK/Zustand imports must use the same React as React Native.
// The web app keeps React 18; Android/Expo uses React 19.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      context,
      require.resolve(moduleName, { paths: [__dirname] }),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
