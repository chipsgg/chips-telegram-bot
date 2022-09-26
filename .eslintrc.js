module.exports = {
    env: {
      browser: true,
      commonjs: true,
      es6: true,
    },
    extends: "eslint:recommended",
    // parser: '@babel/eslint-parser',
    parserOptions: {
      ecmaVersion: 2020,
      requireConfigFile: false,
      sourceType: "module",
      allowImportExportEverywhere: true,
      codeFrame: true,
    },
    globals: {
      Atomics: "readonly",
      SharedArrayBuffer: "readonly",
      // setTimeout: 'readonly',
      BigInt: "readonly",
      Buffer: "readonly",
      setImmediate: 'readonly',
      process: "readonly",
      __dirname: "readonly",
      // console: 'readonly',
    },
    ignorePatterns: ["dist", "node_modules", "test", "**/test.js", "_DEPRICATED", "_DEPRECIATED"],
    rules: {
      // 'no-console': 1,
      // 'no-unused-vars': 1,
      "no-unused-vars": [
        "error",
        { vars: "all", args: "none", ignoreRestSiblings: true },
      ],
    },
  };
  