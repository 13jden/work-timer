// Tauri 专用的前端构建入口
//
// 作用:设置 TAURI_BUILD=1 后调用 Vite 的 build API。
// vite.config.ts 依据该变量:
//   1) 构建结束后删除 dist/downloads/(网站下载页用的旧 APK)
//      —— Tauri 会把整个 dist/ 压缩后链进 Rust 二进制,
//         旧 APK 一旦被嵌进去,APK 体积会从 16.5 MB 暴涨到 73 MB。
//   2) 关闭 sourcemap(约 2.4 MB .map 同样会被嵌入二进制)
//
// 之所以写成脚本而不是在 package.json 里用 set/&&:
// Windows 下 cmd 与 POSIX shell 的环境变量语法不同,脚本可保证两端行为一致。
process.env.TAURI_BUILD = '1';

const { build } = await import('vite');

await build({ logLevel: 'info' });
