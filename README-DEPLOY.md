# Ubuntu 同机部署

当前服务器已有 ClipRAG 和 FinAnalyst，请使用 compose.ubuntu.yml。不要直接运行默认 docker-compose.yml，它会占用现有 80 端口。

- 独立项目 v2a，只发布 127.0.0.1:8890，不改变现有项目。
- 前端本机构建，服务器不运行 npm 构建。
- 首次空库，数据库与视频截图一起持久化到 v2a_data。
- 同时最多一个转换任务，每任务模型并发为一。
- 网页设置 BYOK，不读取 FinAnalyst 的环境文件。
- 初期 SSH 隧道访问，后续域名 v2a.fengjiajun.site。

完整上传、安装、访问、备份、更新及限制见 [Ubuntu 部署手册](docs/deployment/Ubuntu部署.md)。

本机在 frontend 目录设置 VITE_API_BASE_URL 为空并执行 npm run build，再使用 deploy/ubuntu/package_release.py 打包。交付包读取当前工作区，不包含真实数据库、截图、Cookie、.env、虚拟环境或 node_modules，提供逐文件校验清单与压缩包 SHA-256。

服务器执行 bash deploy/ubuntu/install.sh 前，先校验归档并确认安装目录不存在。脚本不重装 Docker，不修改宿主机 Nginx/防火墙，不停止其他项目；失败请保留错误输出，不能删除其他容器和数据卷。
