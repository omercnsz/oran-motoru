module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle'ın ürettiği .sql göç dosyaları metin olarak paketlenir
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
