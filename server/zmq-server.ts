#!/usr/bin/env tsx
/**
 * WTA ZeroMQ Server - TypeScript版本
 * 接收来自Arma 3插件的数据并提供WebSocket接口
 */
import * as zmq from 'zeromq';
import { WebSocketServer, WebSocket } from 'ws';

// 数据类型定义
interface PlatformData {
  id: number;
  role: string;
  pos: { x: number; y: number };
  alive: boolean;
  hit_prob: number;
  cost: number;
  max_range: number;
  max_targets: number;
  quantity: number;
  ammo: {
    missile: number;
    bomb: number;
    rocket: number;
  };
  target_types: number[];
}

interface TargetData {
  id: number;
  kind: string;
  pos: { x: number; y: number };
  alive: boolean;
  value: number;
  tier: number;
}

interface WTAData {
  type: string;
  timestamp: number;
  platforms: PlatformData[];
  targets: TargetData[];
}

interface StoredData {
  timestamp: string | null;
  platforms: PlatformData[];
  targets: TargetData[];
  raw_json: string;
}

// 全局数据存储
const latestData: StoredData = {
  timestamp: null,
  platforms: [],
  targets: [],
  raw_json: ''
};

// WebSocket客户端集合
const wsClients = new Set<WebSocket>();

// ZeroMQ接收器
async function startZmqReceiver() {
  const sock = new zmq.Reply();
  
  await sock.bind('tcp://127.0.0.1:5555');
  console.log('[ZMQ Server] Listening on tcp://127.0.0.1:5555');

  for await (const [msg] of sock) {
    try {
      const message = msg.toString();
      const timestamp = new Date().toISOString();
      
      console.log(`\n[${new Date().toLocaleTimeString()}] Received message (${message.length} bytes)`);

      // 解析JSON
      try {
        const data: any = JSON.parse(message);
        const msgType = data.type || 'unknown';
        
        console.log(`  - Type: ${msgType}`);
        
        // 根据消息类型处理
        if (msgType === 'status_report') {
          // 战场状态上报 - 更新前端数据
          latestData.timestamp = timestamp;
          latestData.platforms = data.platforms || [];
          latestData.targets = data.targets || [];
          latestData.raw_json = message;
          
          console.log(`  - Platforms: ${latestData.platforms.length}`);
          console.log(`  - Targets: ${latestData.targets.length}`);
          
          // 通知所有WebSocket客户端
          broadcastToClients();
          
          // 发送简单响应（不需要规划结果）
          await sock.send(JSON.stringify({
            status: 'ok',
            timestamp: timestamp
          }));
          
        } else if (msgType === 'plan_request') {
          // WTA规划请求 - 需要返回分配方案
          console.log(`  - Plan reason: ${data.reason || 'unknown'}`);
          console.log(`  - Platforms: ${data.platforms?.length || 0}`);
          console.log(`  - Targets: ${data.targets?.length || 0}`);
          
          // TODO: 这里应该调用Python求解器
          // 目前返回空方案
          await sock.send(JSON.stringify({
            type: 'plan_response',
            status: 'ok',
            timestamp: timestamp,
            best_fitness: 0.0,
            assignment: {},
            n_platforms: data.platforms?.length || 0,
            n_targets: data.targets?.length || 0,
            stats: {
              computation_time: 0.0,
              iterations: 0,
              is_valid: true,
              coverage_rate: 0.0
            },
            ttl_sec: 2.0
          }));
          
        } else if (msgType === 'solve') {
          // 旧格式兼容
          latestData.timestamp = timestamp;
          latestData.platforms = data.platforms || [];
          latestData.targets = data.targets || [];
          latestData.raw_json = message;
          
          console.log(`  - Platforms: ${latestData.platforms.length}`);
          console.log(`  - Targets: ${latestData.targets.length}`);
          
          broadcastToClients();
          
          await sock.send(JSON.stringify({
            status: 'ok',
            received_platforms: latestData.platforms.length,
            received_targets: latestData.targets.length,
            timestamp: timestamp
          }));
          
        } else {
          console.warn(`  - Unknown message type: ${msgType}`);
          await sock.send(JSON.stringify({
            status: 'error',
            message: `Unknown message type: ${msgType}`
          }));
        }

      } catch (parseError) {
        console.error('  [ERROR] JSON parse failed:', parseError);
        console.error('  Raw message:', message.substring(0, 200) + '...');
        
        await sock.send(JSON.stringify({
          status: 'error',
          message: 'Invalid JSON'
        }));
      }

    } catch (error) {
      console.error('[ERROR] ZMQ receiver:', error);
    }
  }
}

// WebSocket广播
function broadcastToClients() {
  if (wsClients.size === 0) return;

  const message = JSON.stringify(latestData);
  const disconnected: WebSocket[] = [];

  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('[WebSocket] Send error:', error);
        disconnected.push(client);
      }
    } else {
      disconnected.push(client);
    }
  });

  // 移除断开的客户端
  disconnected.forEach(client => wsClients.delete(client));
}

// WebSocket服务器
function startWebSocketServer() {
  const wss = new WebSocketServer({ port: 8765 });
  
  console.log('[WebSocket Server] Listening on ws://localhost:8765');

  wss.on('connection', (ws: WebSocket) => {
    wsClients.add(ws);
    console.log(`[WebSocket] New client connected (${wsClients.size} total)`);

    // 立即发送当前数据
    if (latestData.timestamp) {
      ws.send(JSON.stringify(latestData));
    }

    // 处理客户端消息
    ws.on('message', (message: Buffer) => {
      const msg = message.toString();
      if (msg === 'ping') {
        ws.send('pong');
      }
    });

    // 处理断开
    ws.on('close', () => {
      wsClients.delete(ws);
      console.log(`[WebSocket] Client disconnected (${wsClients.size} remaining)`);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      wsClients.delete(ws);
    });
  });

  wss.on('error', (error) => {
    console.error('[WebSocket Server] Error:', error);
  });
}

// 主函数
async function main() {
  console.log('='.repeat(60));
  console.log('WTA Dashboard Server (TypeScript)');
  console.log('='.repeat(60));
  console.log('ZeroMQ endpoint: tcp://127.0.0.1:5555');
  console.log('WebSocket endpoint: ws://localhost:8765');
  console.log('='.repeat(60));
  console.log('');

  // 启动WebSocket服务器
  startWebSocketServer();

  // 启动ZeroMQ接收器
  await startZmqReceiver();
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

// 运行
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
