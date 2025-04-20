module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      ['module-resolver', {
        alias: {
          'idb': './node_modules/idb/build/index.js'
        }
      }]
    ],
    env: {
      production: {
        plugins: ['transform-remove-console']
      }
    }
  };
};
// Custom Babel Plugins
module.exports.plugins = ["transform-remove-console"];
