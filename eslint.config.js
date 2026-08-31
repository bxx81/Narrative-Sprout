import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
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
