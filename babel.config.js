module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required by react-native-vision-camera V5 frame processors and Skia
      ['react-native-worklets-core/plugin'],
      // Required by @shopify/react-native-skia animations
      ['react-native-reanimated/plugin'],
    ],
  };
};
