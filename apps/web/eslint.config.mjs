import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      // React Compiler rules added in eslint-config-next 16. Existing code predates
      // them (mounted-state effects, Date.now() in render); fix gradually.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  { ignores: [".next/**", "test-results/**", "playwright-report/**"] },
];

export default config;
