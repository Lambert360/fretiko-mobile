// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for audio files
config.resolver.assetExts.push('mp3', 'MP3', 'wav', 'WAV', 'm4a', 'M4A');

module.exports = config;

