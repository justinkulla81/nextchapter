import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Underscore prefix is this codebase's explicit "required by a
      // signature I don't use" marker — server actions bound via
      // useActionState must accept (_prevState, formData) whether or not
      // they read prevState, and several destructures discard fields on
      // purpose. Warning on those trained us to ignore the unused-vars
      // rule entirely, which hides the real dead code it should catch.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  // CommonJS one-off scripts: require() is their module system.
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Email HTML can't use next/image — mail clients need a plain <img>.
  {
    files: ['src/emails/**'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch drop folder for incoming report assets — not app code.
    "incoming-report/**",
    // Minified, generated report chart bundle — not hand-written source.
    "public/reports/**",
  ]),
]);

export default eslintConfig;
