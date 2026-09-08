# 生产镜像:直接装载「已经构建好的 dist」
#
# dist 由 GitHub Actions 的 CI 作业构建并作为 artifact 传递,
# Deploy 作业用 scp 上传到服务器的项目目录后再 docker compose build,
# 因此这里不再有 node 构建阶段(服务器不需要装 node/npm,构建耗时从 ~10min 降到秒级)。
# 详见 .github/workflows/ci.yml 与 .github/workflows/deploy.yml
#
# 本地手动构建镜像前,必须先自己跑一次前端构建:
#   npm run build
#   docker compose up -d --build

FROM nginx:alpine

# 复制构建产物
COPY dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
