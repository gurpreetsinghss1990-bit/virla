module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    env: {
      production: {
        // Keeps warn/error so production crash reports stay useful.
        plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
      },
    },
  };
};
