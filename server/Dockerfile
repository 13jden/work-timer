# Salary Timer 后端镜像
#
# 多阶段构建：builder 装依赖并编译 TS，runner 只带编译产物 + 生产依赖。
#
# ── 为什么 runner 阶段不再自己 `npm install` ──────────────────
#
# 旧写法在 runner 里又跑了一遍 `npm install --omit=dev`，
# 而 better-sqlite3 是**原生模块**：alpine（musl）没有官方预编译包，
# 每次 install 都要用 node-gyp 从源码编译（装 python3/make/g++，编几分钟）。
# 旧写法等于**编译了两次**，而 deploy.yml 那一步的 command_timeout 只有 10m，
# 服务器上很容易超时。
#
# 现在改成：builder 装一次依赖 → 编译 TS → `npm prune --omit=dev`
#          → runner 直接 COPY builder 的 node_modules。
# better-sqlite3 只编译一次，镜像也更小（不含 devDependencies）。
#
# 为什么用 `npm ci` 而不是 `npm install`：package-lock.json 已入库，
# `npm ci` 严格按锁文件装，保证构建可复现（服务器上装的和 CI 里一样）。

FROM node:22-alpine AS builder
WORKDIR /app

# better-sqlite3 是原生模块，alpine（musl）没有预编译包，需要编译工具链
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 剪掉 devDependencies（typescript / tsx / @types），
# 保留 better-sqlite3 已经编好的原生二进制
RUN npm prune --omit=dev --no-audit --no-fund


FROM node:22-alpine AS runner
WORKDIR /app

# runner 不需要编译工具链了 —— node_modules 从 builder 整个拷过来
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
