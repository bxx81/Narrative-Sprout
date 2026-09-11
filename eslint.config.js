import js from "@eslint/js";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "playwright-report/", "test-results/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node/Bun で実行するビルド補助スクリプト (Tauri の separate-assets 等)。
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    plugins: {
      "better-tailwindcss": betterTailwindcss,
    },
    rules: {
      // eslint-plugin-better-tailwindcss recommended:
      // stylistic は warn、correctness は error で報告される。
      // Tailwind v4 (CSS-first) のため entryPoint で src/index.css を参照する。
      ...betterTailwindcss.configs["recommended"].rules,
      // 改行ルールは prettier-plugin-tailwindcss と競合するため無効化する。
      // 検証結果: wrap を有効にすると prettier --write が複数行化を
      // 1行に戻し、eslint --fix と無限に ping-pong する (98件で確認)。
      // 順序ルールは両者で完全一致するため残す。改行整形は Prettier に一任する。
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      // detectComponentClasses では拾えない自前クラス
      // (@layer base / utilities 定義) と外部アイコンフォントは
      // 未知クラス扱いにしない。CSS 側の定義と 1:1 に対応させること。
      "better-tailwindcss/no-unknown-classes": [
        "error",
        {
          ignore: [
            "^(animate-fade-in|animate-fade-out|body-bg-color|dividers-style|explanation-text-style|font-serif-display|h2-style|legend-text-style|support-text-color|text-bg-color)$",
            "^material-symbols-rounded$",
          ],
        },
      ],
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
    settings: {
      "better-tailwindcss": {
        // Tailwind v4 は CSS-first のため JS コンフィグではなく
        // エントリ CSS を指定する。@theme のカスタムカラー
        // (bg-body-bg 等) や @layer のコンポーネントクラス
        // (form-style 等) の解決に必要。
        entryPoint: "src/index.css",
        // @layer components で定義した自前クラス
        // (form-style・choice-style 等) を未知クラス扱いにしない。
        detectComponentClasses: true,
      },
    },
  },
);
