# Salary Timer 后端镜像
#
# 多阶段构建：builder 装依赖并编译 TS，runner 只带编译产物 + 生产依赖。
#
# ── 【事故复盘】2026-11-10 Deploy #25 构建超时 ───────────────
#
# 那次部署在「Build image and recreate container」失败（耗时 26m13s，
# 撞穿 deploy.yml 的 command_timeout: 25m），结果后端容器没起来，
# 线上 /admin 和 /api/* 全部落回 SPA 首页。
#
# 根因链：
#   1. 基础镜像是 node:22-alpine（musl libc）
#   2. better-sqlite3 是原生模块，install 脚本是
#      `prebuild-install || node-gyp rebuild --release`
#   3. 它的预编译二进制**不在 npm 包里**，而托管在 GitHub Releases
#   4. 国内服务器访问 GitHub Releases 极慢 → prebuild-install 长时间重试
#   5. 超时后**静默回退** node-gyp 源码编译（装 python3/make/g++，编好几分钟）
#   6. 叠加 npm ci 拉包，整个镜像构建冲破 25 分钟
#
# ── 本文件的三项针对性修复 ──────────────────────────────────
#
# ① 基础镜像 node:22-alpine → node:22-slim
#    glibc 直接命中官方最主流的 `linux-x64` 预编译包，命中率高得多。
#
# ② **不再依赖 prebuild-install**，改为显式下载预编译二进制
#    （见下面「better-sqlite3 二进制」一节）。
#    这样彻底消除「预编译没命中 → 静默回退源码编译 → 拖垮部署」这条路。
#    也因此镜像里**不再需要** python3/make/g++ 编译工具链。
#
# ③ npm 源不写死，由 deploy.yml 在服务器上实测连通性后注入
#    （国内访问 npmmirror 时通时不通，见 NPM_REGISTRY build arg）。
#
# ── 为什么用 `npm ci` 而不是 `npm install` ──────────────────
#
# package-lock.json 已入库，`npm ci` 严格按锁文件装，保证构建可复现。
# `--replace-registry-host=always` 让 npm 把锁文件里写死的
# npmmirror 绝对地址改写成实际选定的源，否则探测结果会被绕过。

FROM node:22-slim AS builder
WORKDIR /app

# ── npm 源(由 deploy.yml 实测连通性后注入)────────────────────
#
# 国内服务器访问 registry.npmmirror.com 并不总是稳的（实测时通时断），
# 所以不写死：deploy.yml 会先在服务器上探测哪个源能连上，
# 再把结论通过 build args 传进来。
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REPLACE_REGISTRY_HOST=always

# ca-certificates: HTTPS 拉包需要
# curl: 显式下载 better-sqlite3 预编译二进制
#
# ⚠️ **不要**在这里装 build-essential / python3 / make / g++。
#   没有编译工具链是**故意的**:万一预编译二进制拉不到,
#   node-gyp 会立刻因为缺工具链而**快速失败**,
#   而不是默默编译十几分钟把整个部署拖超时。
#   那正是 2026-11-10 Deploy #25 失败的原因。
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# ── npm 依赖层(单独一层,充分利用 Docker 层缓存)──────────────
#
# 只 COPY package.json / package-lock.json,让这一层的缓存键
# **只跟依赖清单有关**。源码改动不会让这一层失效,
# 下次部署就能直接复用缓存的 node_modules。
#
# (如果把 src/ 也 COPY 进来,每改一行代码都要重装全部依赖。)
COPY package.json package-lock.json .npmrc ./

# ── --ignore-scripts: 跳过所有 install 脚本 ──────────────────
#
# 关键一步。better-sqlite3 的 install 脚本
# `prebuild-install || node-gyp rebuild` 里，那条 `|| node-gyp` 兜底
# 是本次事故的元凶：它会把「预编译包没命中」变成「默默编译十几分钟」。
#
# 跳过脚本后，better-sqlite3 的原生二进制由下一段显式安装，
# 行为完全确定：要么拿到预编译包（秒级），要么直接失败（快）。
# 绝不会出现「卡住」。
#
# esbuild / tsx 的 postinstall 也一并跳过 —— 它们只在 dev 模式用
# （npm run dev / tsx watch），构建产物由 tsc 生成（纯 TS，不依赖 esbuild），
# 且随后会被 npm prune --omit=dev 删掉。
RUN npm ci --no-audit --no-fund --ignore-scripts \
  --registry="$NPM_REGISTRY" \
  --replace-registry-host="$NPM_REPLACE_REGISTRY_HOST"

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 剪掉 devDependencies（typescript / tsx / @types），
# 保留 better-sqlite3 本身（它是 production dependency）
RUN npm prune --omit=dev --no-audit --no-fund --ignore-scripts

# ── better-sqlite3 二进制:显式下载预编译包 ───────────────────
#
# 为什么不用 prebuild-install 自动下载:
#   它的失败模式是「静默回退源码编译」,在服务器上就是一次 25 分钟超时。
#   显式下载的失败模式是「命令直接报错退出」,几秒内就知道结果。
#
# 为什么不用 npm_config_..._binary_host 环境变量:
#   那样能指到 npmmirror CDN（实测 0.2s），但仍保留着
#   prebuild-install 的自动匹配逻辑 —— 万一 ABI / libc 变体没命中，
#   还是会回退源码编译。这里把匹配逻辑也一并去掉。
#
# 为什么放在 npm prune **之后**:
#   放到最后一步,保证它不会被前面任何 npm 操作
#   （npm ci 的重装、prune 的清理）动到。
#
# URL 规则（见 prebuild-install/util.js 的 urlTemplate）:
#   {name}-v{version}-node-v{abi}-{platform}{libc}-{arch}.tar.gz
#   linux + glibc → platform=linux, libc=''
#   node 22 的 ABI = 127,即
#   better-sqlite3-v11.10.0-node-v127-linux-x64.tar.gz
#
# ABI 不写死 127,而是从当前 node 运行时读（process.versions.modules）,
# 将来升级 Node 大版本不会悄悄失配。
#
# ⚠️ 预编译包并不覆盖所有 ABI（实测 11.10.0 只有 108/115/127/131,
#    没有 137 = node 24）。所以这一步失败时**必须直接失败**,
#    绝不能有「回退源码编译」的分支 —— 那正是上次事故的根因。
#    报错的排查方向是「换一个 Node 版本」,而不是「装编译工具链」。
RUN set -eux; \
  BS3_VER="$(node -p "require('./node_modules/better-sqlite3/package.json').version")"; \
  BS3_ABI="$(node -p "process.versions.modules")"; \
  BS3_URL="https://cdn.npmmirror.com/binaries/better-sqlite3/v${BS3_VER}/better-sqlite3-v${BS3_VER}-node-v${BS3_ABI}-linux-x64.tar.gz"; \
  echo "better-sqlite3 v${BS3_VER} (ABI ${BS3_ABI})"; \
  echo "下载地址: ${BS3_URL}"; \
  curl -sSfL --retry 3 --retry-delay 2 --max-time 180 \
    "${BS3_URL}" -o /tmp/better-sqlite3.tar.gz; \
  mkdir -p node_modules/better-sqlite3; \
  tar -xzf /tmp/better-sqlite3.tar.gz -C node_modules/better-sqlite3; \
  test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node; \
  rm -f /tmp/better-sqlite3.tar.gz; \
  node -e "require('better-sqlite3')(':memory:').close(); console.log('✓ better-sqlite3 原生模块加载成功')"


FROM node:22-slim AS runner
WORKDIR /app

# runner 不需要编译工具链 —— node_modules 从 builder 整个拷过来
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY public ./public

# SQLite 数据目录（用 volume 挂载持久化）
RUN mkdir -p /data
ENV PORT=8787
ENV DB_PATH=/data/salary-timer.db

EXPOSE 8787
CMD ["node", "dist/index.js"]
