# 🚀 Docker 一键部署指南

本指南将帮助你在任何安装了 Docker 的云服务器（VPS）上一键拉起该项目。

## 1. 准备环境

请确保你的服务器已安装 Docker 和 Docker Compose。

## 2. 启动服务

首先，如果你的后端数据库文件还不存在，请先创建一个空的数据库文件，以免 Docker 将其误认为目录：

``bash
# Windows
New-Item -ItemType File -Path "backend\app.db" -Force

# Linux / Mac
touch backend/app.db
``

然后在项目根目录（即 docker-compose.yml 所在的目录），运行以下命令：

``bash
docker-compose up -d --build
``

## 3. 访问项目

启动完成后，前端会自动运行在服务器的 80 端口。
请在浏览器中访问：http://<你的服务器IP>

## 4. 架构说明

- **前端 (Frontend)**: 基于 Nginx 部署，静态文件由 Nginx 分发。
- **反向代理**: Nginx 会自动将所有 /api/ 开头的请求转发到后台的 ackend 容器。
- **数据持久化**: ackend/app.db（SQLite数据库文件）通过 Volume 挂载到了宿主机，即使重启或重建容器，历史生成记录也不会丢失。

## 5. 更新代码后如何重新部署？

如果在本地修改了代码并同步到服务器，只需再次运行：

``bash
docker-compose up -d --build
``

