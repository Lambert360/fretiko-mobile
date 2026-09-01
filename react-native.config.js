module.exports = {
  project: {
    android: {
      packageName: 'com.kinging.fretikomobile',
      sourceDir: 'android',
    },
    ios: {
      sourceDir: 'ios',
    },
  },
  dependencies: {
    '@react-native-firebase/app': {
      platforms: {
        ios: null,
      },
    },
    '@react-native-firebase/messaging': {
      platforms: {
        ios: null,
      },
    },
  },
};
