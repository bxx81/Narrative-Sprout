import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `using x = ...` は破棄のためだけに束縛するのが正規の使い方なので、
      // `_` 始まりを未使用扱いにしない (1つずつ eslint-disable しない)。
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // 再設計書 §5.7: レコード/配列スキーマへの .catch() の全面禁止
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.property.name="catch"][callee.object.callee.property.name=/^(record|array)$/]',
          message:
            "Do not use .catch() on record/array schemas — validate element-wise instead (REDESIGN.md §5.7).",
        },
      ],
    },
  },
);
