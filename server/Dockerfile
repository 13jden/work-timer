# Salary Timer 后端镜像
#
# 多阶段构建:builder 装依赖并编译 TS,runner 只带编译产物 + 生产依赖。
FROM node:22-alpine AS builder
WORKDIR /app

# better-sqlite3 是原生模块,alpine 需要编译工具链
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY public ./public

# SQLite 数据目录(用 volume 挂载持久化)
RUN mkdir -p /data
ENV PORT=8787
ENV DB_PATH=/data/salary-timer.db

EXPOSE 8787
CMD ["node", "dist/index.js"]
