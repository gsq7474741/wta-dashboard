#!/usr/bin/env tsx
/**
 * WTA ZeroMQ Server - TypeScript版本（Protobuf）
 * 接收来自Arma 3插件的Protobuf消息并提供WebSocket接口
 */
import * as zmq from 'zeromq';
import { WebSocketServer, WebSocket } from 'ws';
import { 
  WTAMessage, 
  StatusReportEvent,
  PlanRequest,
  PlanResponse,
  PlatformState,
  TargetState,
  PlatformRole,
  TargetKind
} from '../proto/generated/wta_messages';

// 存储数据用于前端展示
interface StoredData {
  timestamp: string | null;
  platforms: PlatformState[];
  targets: TargetState[];
  messageType: string;
}

// 全局数据存储
const latestData: StoredData = {
  timestamp: null,
  platforms: [],
  targets: [],
  messageType: 'none'
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
      const buffer = Buffer.from(msg);
      const timestamp = new Date().toISOString();
      
      console.log(`\n[${new Date().toLocaleTimeString()}] Received message (${buffer.length} bytes)`);

      // 解析Protobuf
      try {
        const message = WTAMessage.decode(buffer);
        
        // 根据oneof字段判断消息类型
        if (message.statusReport) {
          // 战场状态上报 - 更新前端数据
          console.log('  - Type: StatusReport');
          console.log(`  - Platforms: ${message.statusReport.platforms.length}`);
          console.log(`  - Targets: ${message.statusReport.targets.length}`);
          
          // 🔍 详细调试：打印前3个平台的位置
          if (message.statusReport.platforms.length > 0) {
            console.log('  - Platform Positions (first 3):');
            for (let i = 0; i < Math.min(3, message.statusReport.platforms.length); i++) {
              const p = message.statusReport.platforms[i];
              const pos = p.pos || { x: 0, y: 0 };
              console.log(`    [${i+1}] ID=${p.id}, Role=${p.role}, Pos=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
            }
          }
          
          // 🔍 检测数据是否变化
          let dataChanged = false;
          if (latestData.platforms.length === message.statusReport.platforms.length) {
            // 对比第一个平台的位置
            if (latestData.platforms.length > 0 && message.statusReport.platforms.length > 0) {
              const oldPos = latestData.platforms[0].pos || { x: 0, y: 0 };
              const newPos = message.statusReport.platforms[0].pos || { x: 0, y: 0 };
              const distMoved = Math.sqrt(
                Math.pow(newPos.x - oldPos.x, 2) + Math.pow(newPos.y - oldPos.y, 2)
              );
              if (distMoved > 0.1) {
                dataChanged = true;
                console.log(`  ✅ DATA CHANGED: Platform #1 moved ${distMoved.toFixed(2)}m`);
                console.log(`     Old: (${oldPos.x.toFixed(1)}, ${oldPos.y.toFixed(1)})`);
                console.log(`     New: (${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)})`);
              } else {
                console.log(`  ⚠️  DATA UNCHANGED: Platform #1 position same (dist=${distMoved.toFixed(4)}m)`);
              }
            }
          } else {
            dataChanged = true;
            console.log(`  ✅ DATA CHANGED: Platform count changed (${latestData.platforms.length} -> ${message.statusReport.platforms.length})`);
          }
          
          latestData.timestamp = timestamp;
          latestData.platforms = message.statusReport.platforms;
          latestData.targets = message.statusReport.targets;
          latestData.messageType = 'status_report';
          
          // 通知所有WebSocket客户端
          broadcastToClients();
          
          // 发送简单响应（fire-and-forget，不需要规划结果）
          const response: PlanResponse = {
            status: 'ok',
            timestamp: Date.now() / 1000,
            bestFitness: 0,
            assignment: {},
            nPlatforms: 0,
            nTargets: 0,
            stats: {
              computationTime: 0,
              iterations: 0,
              isValid: true,
              coverageRate: 0
            },
            ttlSec: 0,
            errorMsg: ''
          };
          
          const responseMsg = WTAMessage.create({ planResponse: response });
          const responseBuffer = WTAMessage.encode(responseMsg).finish();
          await sock.send(responseBuffer);
          
        } else if (message.planRequest) {
          // WTA规划请求 - 需要返回分配方案
          console.log('  - Type: PlanRequest');
          console.log(`  - Reason: ${message.planRequest.reason}`);
          console.log(`  - Platforms: ${message.planRequest.platforms.length}`);
          console.log(`  - Targets: ${message.planRequest.targets.length}`);
          
          // TODO: 这里应该调用Python求解器
          // 目前返回空方案作为占位
          const response: PlanResponse = {
            status: 'ok',
            timestamp: Date.now() / 1000,
            bestFitness: 0.0,
            assignment: {},  // 空分配方案
            nPlatforms: message.planRequest.platforms.length,
            nTargets: message.planRequest.targets.length,
            stats: {
              computationTime: 0.001,
              iterations: 0,
              isValid: true,
              coverageRate: 0.0
            },
            ttlSec: 2.0,
            errorMsg: ''
          };
          
          const responseMsg = WTAMessage.create({ planResponse: response });
          const responseBuffer = WTAMessage.encode(responseMsg).finish();
          await sock.send(responseBuffer);
          
        } else if (message.entityKilled) {
          // 实体击毁事件
          console.log('  - Type: EntityKilled');
          console.log(`  - Entity: ${message.entityKilled.entityType} #${message.entityKilled.entityId}`);
          
          // 简单确认响应
          const response: PlanResponse = {
            status: 'ok',
            timestamp: Date.now() / 1000,
            bestFitness: 0,
            assignment: {},
            nPlatforms: 0,
            nTargets: 0,
            stats: { computationTime: 0, iterations: 0, isValid: true, coverageRate: 0 },
            ttlSec: 0,
            errorMsg: ''
          };
          const responseMsg = WTAMessage.create({ planResponse: response });
          await sock.send(WTAMessage.encode(responseMsg).finish());
          
        } else if (message.damage) {
          // 伤害事件
          console.log('  - Type: Damage');
          console.log(`  - Entity: ${message.damage.entityType} #${message.damage.entityId}, damage=${message.damage.damageAmount}`);
          
          const response: PlanResponse = {
            status: 'ok',
            timestamp: Date.now() / 1000,
            bestFitness: 0,
            assignment: {},
            nPlatforms: 0,
            nTargets: 0,
            stats: { computationTime: 0, iterations: 0, isValid: true, coverageRate: 0 },
            ttlSec: 0,
            errorMsg: ''
          };
          const responseMsg = WTAMessage.create({ planResponse: response });
          await sock.send(WTAMessage.encode(responseMsg).finish());
          
        } else if (message.fired) {
          // 开火事件
          console.log('  - Type: Fired');
          console.log(`  - Platform #${message.fired.platformId} -> Target #${message.fired.targetId}`);
          
          const response: PlanResponse = {
            status: 'ok',
            timestamp: Date.now() / 1000,
            bestFitness: 0,
            assignment: {},
            nPlatforms: 0,
            nTargets: 0,
            stats: { computationTime: 0, iterations: 0, isValid: true, coverageRate: 0 },
            ttlSec: 0,
            errorMsg: ''
          };
          const responseMsg = WTAMessage.create({ planResponse: response });
          await sock.send(WTAMessage.encode(responseMsg).finish());
          
        } else {
          console.warn('  - Unknown message type (all fields undefined)');
          const response: PlanResponse = {
            status: 'error',
            timestamp: Date.now() / 1000,
            bestFitness: 0,
            assignment: {},
            nPlatforms: 0,
            nTargets: 0,
            stats: { computationTime: 0, iterations: 0, isValid: false, coverageRate: 0 },
            ttlSec: 0,
            errorMsg: 'Unknown message type'
          };
          const responseMsg = WTAMessage.create({ planResponse: response });
          await sock.send(WTAMessage.encode(responseMsg).finish());
        }

      } catch (parseError) {
        console.error('  [ERROR] Protobuf decode failed:', parseError);
        console.error('  Buffer length:', buffer.length);
        console.error('  First 32 bytes:', buffer.subarray(0, Math.min(32, buffer.length)).toString('hex'));
        
        // 返回错误响应
        const response: PlanResponse = {
          status: 'error',
          timestamp: Date.now() / 1000,
          bestFitness: 0,
          assignment: {},
          nPlatforms: 0,
          nTargets: 0,
          stats: { computationTime: 0, iterations: 0, isValid: false, coverageRate: 0 },
          ttlSec: 0,
          errorMsg: 'Protobuf decode failed'
        };
        const responseMsg = WTAMessage.create({ planResponse: response });
        await sock.send(WTAMessage.encode(responseMsg).finish());
      }

    } catch (error) {
      console.error('[ERROR] ZMQ receiver:', error);
    }
  }
}

// WebSocket广播
function broadcastToClients() {
  if (wsClients.size === 0) {
    console.log('  ⚠️  No WebSocket clients connected, skip broadcast');
    return;
  }

  const message = JSON.stringify(latestData);
  const disconnected: WebSocket[] = [];
  
  // 🔍 打印即将发送的数据摘要
  const preview = {
    timestamp: latestData.timestamp,
    platformCount: latestData.platforms.length,
    targetCount: latestData.targets.length,
    messageType: latestData.messageType,
    firstPlatformPos: latestData.platforms[0]?.pos || null
  };
  console.log(`  📤 Broadcasting to ${wsClients.size} client(s):`, JSON.stringify(preview));

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
  
  if (disconnected.length > 0) {
    console.log(`  🔌 Removed ${disconnected.length} disconnected client(s)`);
  }
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
  console.log('WTA Dashboard Server (TypeScript + Protobuf)');
  console.log('='.repeat(60));
  console.log('ZeroMQ endpoint: tcp://127.0.0.1:5555 (Protobuf)');
  console.log('WebSocket endpoint: ws://localhost:8765 (JSON)');
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
