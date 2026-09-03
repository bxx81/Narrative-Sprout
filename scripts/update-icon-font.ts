export {};

declare const Bun: {
  file(path: URL): { text(): Promise<string> };
  write(path: URL, data: ArrayBuffer): Promise<number>;
  exit(code?: number): never;
};

const iconFilePath = new URL("../src/components/ui/Icon.tsx", import.meta.url);
const fontOutputPath = new URL("../public/s/font.woff2", import.meta.url);

const cssEndpoint =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0";
const woff2UrlPattern = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+?)\)\s*format\((['"])woff2\2\)/;
const requestUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const iconFileSource = await Bun.file(iconFilePath).text();

const unionMatch = iconFileSource.match(/export type IconName =([^;]+);/s);
if (!unionMatch) {
  console.error("Icon.tsx に export type IconName が見つかりませんでした。");
  Bun.exit(1);
}

const iconNames = [
  ...new Set([...unionMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])),
].sort();
if (iconNames.length === 0) {
  console.error("IconName の union にアイコン名がありません。");
  Bun.exit(1);
}

// const unionDeclaration = `export type IconName =\n  | ${iconNames.map((name) => `"${name}"`).join("\n  | ")};`;
// if (unionMatch[0] !== unionDeclaration) {
//   await Bun.write(iconFilePath, iconFileSource.replace(unionMatch[0], unionDeclaration));
//   console.log(`Icon.tsx の IconName をアルファベット順に整列しました (${iconNames.length} icons)。`);
// }

const cssResponse = await fetch(`${cssEndpoint}&icon_names=${iconNames.join(",")}`, {
  headers: { "User-Agent": requestUserAgent },
});
if (!cssResponse.ok) {
  console.error(
    `Google Fonts CSS の取得に失敗しました (${cssResponse.status})。\n${await cssResponse.text()}`,
  );
  Bun.exit(1);
}

const css = await cssResponse.text();
const fontUrl = css.match(woff2UrlPattern)?.[1];
if (!fontUrl) {
  console.error(`CSS に woff2 の URL が見つかりませんでした。\n${css}`);
  Bun.exit(1);
}

const fontResponse = await fetch(fontUrl, { headers: { "User-Agent": requestUserAgent } });
if (!fontResponse.ok) {
  console.error(`フォントファイルの取得に失敗しました (${fontResponse.status})。`);
  Bun.exit(1);
}

const fontBytes = await fontResponse.arrayBuffer();
await Bun.write(fontOutputPath, fontBytes);
console.log(
  `${iconNames.length} icons -> ${fontUrl}\npublic/s/font.woff2 へ書き出しました (${fontBytes.byteLength} bytes)。`,
);
