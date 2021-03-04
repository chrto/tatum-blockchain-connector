module.exports = function () {
    return {
      files: [
        "package.json",
        "jest.config.js",
        "src/**/*.ts",
        "!src/**/*.spec.ts",
        "!src/**/*.sandbox.ts"
      ],
  
      tests: [
        "src/**/*.spec.ts"
      ],
  
      env: {
        type: "node"
      },
      // or any other supported testing framework:
      // https://wallabyjs.com/docs/integration/overview.html#supported-testing-frameworks
      testFramework: "jest",
      debug: true,
      setup: function (wallaby) {
        var jestConfig = require('./package.json').jest;
        wallaby.testFramework.configure(jestConfig);
      }
    };
  };
  