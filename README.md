# WTA Dashboard (Next.js + TypeScript)

**完全使用TypeScript技术栈**的WTA实时监控Dashboard，无需Python。

## ✨ 特性

- 🚀 **Next.js 14** - React框架
- 📘 **TypeScript** - 类型安全
- 🎨 **TailwindCSS** - 现代化UI
- 📡 **ZeroMQ (Node.js)** - 接收Arma 3数据
- 🔌 **WebSocket** - 实时推送到浏览器
- ⚡ **无需Python** - 纯JavaScript/TypeScript栈

## 🎯 Node.js ZeroMQ支持

**是的！Node.js完全支持ZeroMQ**：
- 官方库：`zeromq` npm包
- 原生Node.js绑定
- 支持所有ZeroMQ模式（REQ/REP, PUB/SUB等）
- TypeScript类型支持
- 性能与Python版本相当

## 📦 安装

### 前置要求

- Node.js 18+（推荐使用pnpm）
- Windows构建工具（用于编译原生模块）

### 安装依赖

```bash
cd d:\WindsurfProjects\wta-dashboard

# 使用pnpm（推荐）
pnpm install

# 或使用npm
npm install
```

## 🚀 使用方法

### 方式一：分离运行（推荐）

**1. 启动ZeroMQ服务器**（接收Arma 3数据）
```bash
pnpm zmq
# 或 npm run zmq
```

**2. 启动Next.js Dashboard**（另一个终端）
```bash
pnpm dev
# 或 npm run dev
```

**3. 打开浏览器**
```
http://localhost:3001
```

### 方式二：生产部署

```bash
# 构建
pnpm build

# 启动
pnpm start
```

## 📊 架构说明

```
┌─────────────────┐
│  Arma 3 Plugin  │ (C++)
│  wtaPlugin.dll  │
└────────┬────────┘
         │ ZeroMQ (tcp://127.0.0.1:5555)
         │ JSON数据
         ▼
┌─────────────────┐
│  zmq-server.ts  │ (Node.js + TypeScript)
│  ZeroMQ服务器    │ - 接收Arma 3数据
│  +               │ - 解析JSON
│  WebSocket服务器 │ - 广播到前端
└────────┬────────┘
         │ WebSocket (ws://localhost:8765)
         │ 实时推送
         ▼
┌─────────────────┐
│   Next.js App   │ (React + TypeScript)
│   Dashboard UI  │ - 实时可视化
│                 │ - 统计卡片
│                 │ - 平台/目标列表
└─────────────────┘
```

## 📁 项目结构

```
wta-dashboard/
├── app/
│   ├── layout.tsx       # 根布局
│   ├── page.tsx         # Dashboard主页
│   └── globals.css      # 全局样式
├── server/
│   └── zmq-server.ts    # ZeroMQ + WebSocket服务器
├── package.json         # 依赖配置
├── tsconfig.json        # TypeScript配置
├── tailwind.config.ts   # Tailwind配置
└── next.config.js       # Next.js配置
```

## 🔧 端口配置

- **Next.js**: `3001`
- **ZeroMQ**: `tcp://127.0.0.1:5555`
- **WebSocket**: `ws://localhost:8765`

如需修改，编辑：
- `server/zmq-server.ts` - ZeroMQ和WebSocket端口
- `app/page.tsx` - WebSocket客户端连接地址
- `package.json` - Next.js端口（`-p 3001`）

## 📡 数据流示例

### Arma 3发送的JSON

```json
{
  "type": "solve",
  "timestamp": 1731607200,
  "platforms": [
    {
      "id": 1,
      "role": "AntiPersonnel",
      "pos": {"x": 1234.5, "y": 5678.9},
      "alive": true,
      "hit_prob": 0.75,
      "cost": 10.0,
      "max_range": 4000.0,
      "max_targets": 1,
      "quantity": 1,
      "ammo": {
        "missile": 4,
        "bomb": 2,
        "rocket": 0
      },
      "target_types": [0, 1, 2, 3]
    }
  ],
  "targets": [
    {
      "id": 1,
      "kind": "Infantry",
      "pos": {"x": 1300.0, "y": 5700.0},
      "alive": true,
      "value": 20.0,
      "tier": 0
    }
  ]
}
```

### ZeroMQ服务器响应

```json
{
  "status": "ok",
  "received_platforms": 26,
  "received_targets": 46,
  "timestamp": "2025-11-15T02:30:00.123Z"
}
```

## 🎮 测试步骤

1. **安装依赖**
   ```bash
   pnpm install
   ```

2. **启动ZeroMQ服务器**
   ```bash
   pnpm zmq
   ```
   应该看到：
   ```
   ============================================================
   WTA Dashboard Server (TypeScript)
   ============================================================
   ZeroMQ endpoint: tcp://127.0.0.1:5555
   WebSocket endpoint: ws://localhost:8765
   ============================================================
   
   [ZMQ Server] Listening on tcp://127.0.0.1:5555
   [WebSocket Server] Listening on ws://localhost:8765
   ```

3. **启动Next.js（新终端）**
   ```bash
   pnpm dev
   ```

4. **打开浏览器**
   - 访问 http://localhost:3001
   - 应该看到Dashboard界面
   - 连接状态显示"Connected"（绿色）

5. **启动Arma 3**
   - 加载包含无人机和敌军的任务
   - 观察Dashboard实时更新
   - ZeroMQ服务器控制台会显示接收的消息

## 🐛 故障排除

### 问题：zeromq安装失败

**Windows需要构建工具**：
```bash
npm install --global windows-build-tools
```

或安装 Visual Studio Build Tools。

### 问题：Dashboard显示"Disconnected"

- 确认zmq-server.ts正在运行
- 检查端口8765没有被占用
- 刷新浏览器页面

### 问题：ZeroMQ收不到数据

- 确认Arma 3插件已编译并部署
- 检查RPT日志是否有"WTA: Sending"消息
- 确认端口5555没有被占用

## 📈 性能优势

相比Python版本：
- ✅ **统一技术栈** - 全JavaScript/TypeScript
- ✅ **更快启动** - Node.js启动速度快
- ✅ **易于部署** - 单一运行时环境
- ✅ **更好集成** - 与Next.js无缝集成
- ✅ **类型安全** - 完整TypeScript支持

## 🚀 下一步

- [x] M1 - 单位数据采集
- [x] M2 - ZeroMQ通信与Dashboard
- [ ] M3 - 求解器算法
- [ ] M4 - 任务执行与反馈

## 📝 开发笔记

### 为什么选择Node.js ZeroMQ？

1. **成熟稳定** - zeromq npm包已维护多年
2. **原生性能** - C++绑定，性能优异
3. **统一栈** - 前后端都用TypeScript
4. **易维护** - 减少技术栈复杂度
5. **生态丰富** - npm生态系统支持

### TypeScript优势

- 编译期类型检查
- IDE智能提示
- 重构更安全
- 代码更易维护

---

**版本**: v0.2.0 (TypeScript)  
**更新**: 2025-11-15  
**技术栈**: Next.js + TypeScript + ZeroMQ + WebSocket
