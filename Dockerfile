# 生产镜像:直接装载「已经构建好的 dist」,由 Caddy 提供 HTTPS
#
# dist 由 GitHub Actions 的 CI 作业构建并作为 artifact 传递,
# Deploy 作业用 scp 上传到服务器的项目目录后再 docker compose build,
# 因此这里没有 node 构建阶段(服务器不需要装 node/npm,构建耗时从 ~10min 降到秒级)。
# 详见 .github/workflows/ci.yml 与 .github/workflows/deploy.yml
#
# 为什么是 Caddy 而不是 nginx:证书申请、续签、80→443 跳转全自动,不需要 certbot 容器和续签定时器。
# 站点地址 / 证书模式见 Caddyfile 与 docker-compose.yml 的环境变量。
#
# 证书存放:容器内 /data(证书) 与 /config,由 docker-compose.yml 的命名卷持久化,
# 容器重建不会丢证书(否则反复申请会撞 Let's Encrypt 速率限制)。
#
# 本地手动构建镜像前,必须先自己跑一次前端构建:
#   npm run build
#   docker compose up -d --build

FROM caddy:2-alpine

# 前端产物(Caddy 站点根目录 /srv)
COPY dist /srv

# 站点配置(镜像默认 CMD 就是 caddy run --config /etc/caddy/Caddyfile --adapter caddyfile)
COPY Caddyfile /etc/caddy/Caddyfile

# HTTP(跳转用) + HTTPS
EXPOSE 80 443
