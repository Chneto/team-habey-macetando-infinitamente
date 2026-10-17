export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        console: "readonly",
        CustomEvent: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        performance: "readonly",
        navigator: "readonly",
        HTMLCanvasElement: "readonly",
        Image: "readonly",
        Phaser: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
      "no-unreachable": "error",
      "no-constant-condition": "warn"
    }
  }
];
