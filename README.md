# GitHub 镜像加速项目

一个完整的一站式 GitHub 镜像加速解决方案，利用 Cloudflare Workers 和 Tampermonkey 用户脚本。

## 📁 项目结构

```
├── Workers/                   # Cloudflare Workers 代理脚本
│   ├── workers1.js            # 完整 GitHub 镜像代理（支持所有功能）
│   └── workers2.js             # 文件下载加速代理（仅支持文件下载）
└── Tampermonkey示例脚本/        # 浏览器用户脚本
    ├── GitHub镜像站增强工具.js   # 下载加速+重定向+汉化的脚本
```

## 🚀 功能特性

### Cloudflare Workers 代理

#### workers1.js - 完整镜像代理
- ✅ 支持较为完整的 GitHub 功能访问
- ✅ 多域名映射（hub、raw、assets、download、object、media、gist）
- ✅ 自动域名解析和反向映射
- ✅ 智能请求过滤（favicon、sw.js 等）
- ✅ robots.txt 防爬虫保护

#### workers2.js - 文件下载加速
- ✅ 专注于 GitHub 文件下载加速
- ✅ 白名单域名控制
- ✅ 美观的首页界面
- ✅ 简单部署，即开即用
- ⚠️ 仅支持文件下载，不支持其他 GitHub 功能

## 🛠️ 部署指南

### Cloudflare Workers 部署

#### 一：完整镜像代理（workers1.js）

1. **创建 Worker**
   - 登录 Cloudflare Dashboard
   - 进入 Workers & Pages
   - 创建新的 Worker
   - 复制 `workers1.js` 内容到编辑器

2. **配置环境变量**
   ```
   变量名：DOMAIN
   变量值：yourdomain.com（你的域名）
   类型：TXT
   ```

3. **添加自定义域名**
   在 Workers 的自定义域功能与路由功能中分别添加以下相同域名：

   ```
   hub.yourdomain.com
   raw.yourdomain.com
   assets.yourdomain.com
   download.yourdomain.com
   object.yourdomain.com
   media.yourdomain.com
   gist.yourdomain.com
   ```

4. **配置路由**
   在路由功能中添加相同的域名列表

#### 二：文件下载加速（workers2.js）

1. **创建 Worker**
   - 复制 `workers2.js` 内容到新的 Worker
   - 直接部署，无需额外配置

2. **绑定域名**
   - 绑定你的自定义域名
   - 访问域名即可使用

### Tampermonkey 脚本安装

- 复制对应的 `.js` 文件内容
- 在 Tampermonkey 中创建新脚本
- 粘贴`GitHub镜像站加速下载.js`或`GitHub镜像站汉化脚本.js`
- 修改其中`mihoyo.online`为`yourdomain.com`
- 保存并启用脚本

## 🎯 使用方法

### 1. 直接访问镜像站
- 将 `github.com` 替换为 `hub.yourdomain.com`
- 例如：`https://hub.yourdomain.com/`

### 2. 使用 Tampermonkey 脚本
- 正常访问 GitHub
- 脚本会自动添加文件下载加速按钮
- 界面自动汉化（如果安装了汉化脚本）

### 3. 文件下载加速
- 访问你的 workers2.js 绑定的域名
- 在首页输入 GitHub 文件链接
- 点击加速下载

## 📝 注意事项

1. **域名要求**
   - 建议使用具有完全控制权的一级域名
   - 需要使用 CloudFlare 提供的域名权威 DNS 解析服务，且在部署 Workers 的同一 CloudFlare 账号下
2. **功能限制**
   - workers2.js 仅支持文件下载，不支持完整 GitHub 功能
   - 部分功能可能需要登录 GitHub 账户
3. **合规使用**
   - 请遵守 GitHub 服务条款
   - 不要用于商业用途
   - 避免过度请求

## 🔗 鸣谢

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [nil's blog](https://dodoo.co/prepare/skill/cloudflare/github-proxy)
- [fscarmen2](https://github.com/fscarmen2/Cloudflare-Accel)
- [maboloshi](https://greasyfork.org/zh-CN/scripts/435208-github-%E4%B8%AD%E6%96%87%E5%8C%96%E6%8F%92%E4%BB%B6)
- [X.I.U](https://greasyfork.org/zh-CN/scripts/412245-github-enhancement-high-speed-download)
