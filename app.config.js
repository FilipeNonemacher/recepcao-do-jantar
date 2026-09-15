const { expo } = require('./app.json');

module.exports = {
  expo: {
    ...expo,
    web: {
      ...expo.web,
      bundler: 'metro',
      output: 'single',
      name: 'Recepção do Jantar',
      shortName: 'Jantar',
    },
    experiments: {
      ...expo.experiments,
      baseUrl: process.env.EXPO_BASE_URL || undefined,
    },
  },
};
