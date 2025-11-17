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

// ==================== 日志系统 ====================
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 从环境变量读取日志级别，默认为 INFO
const LOG_LEVEL: LogLevel = (() => {
  const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
})();

// 颜色代码
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// 日志函数
function log(level: LogLevel, prefix: string, message: string, data?: any) {
  if (level < LOG_LEVEL) return;

  const timestamp = new Date().toLocaleTimeString();
  let colorCode = colors.reset;
  let levelStr = '';

  switch (level) {
    case LogLevel.DEBUG:
      colorCode = colors.cyan;
      levelStr = '[DEBUG]';
      break;
    case LogLevel.INFO:
      colorCode = colors.green;
      levelStr = '[INFO]';
      break;
    case LogLevel.WARN:
      colorCode = colors.yellow;
      levelStr = '[WARN]';
      break;
    case LogLevel.ERROR:
      colorCode = colors.red;
      levelStr = '[ERROR]';
      break;
  }

  const header = `${colorCode}${levelStr}${colors.reset} ${colors.dim}[${timestamp}]${colors.reset} ${prefix}`;
  
  if (data !== undefined) {
    console.log(header, message, data);
  } else {
    console.log(header, message);
  }
}

// 便捷函数
const logger = {
  debug: (prefix: string, message: string, data?: any) => log(LogLevel.DEBUG, prefix, message, data),
  info: (prefix: string, message: string, data?: any) => log(LogLevel.INFO, prefix, message, data),
  warn: (prefix: string, message: string, data?: any) => log(LogLevel.WARN, prefix, message, data),
  error: (prefix: string, message: string, data?: any) => log(LogLevel.ERROR, prefix, message, data)
};

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
  logger.info('[ZMQ]', 'Listening on tcp://127.0.0.1:5555');

  for await (const [msg] of sock) {
    try {
      const buffer = Buffer.from(msg);
      const timestamp = new Date().toISOString();
      
      logger.info('[ZMQ]', `Received message (${buffer.length} bytes)`);

      // 解析Protobuf
      try {
        const message = WTAMessage.decode(buffer);
        
        // 根据oneof字段判断消息类型
        if (message.statusReport) {
          // 战场状态上报 - 更新前端数据
          logger.info('[ZMQ]', 'Type: StatusReport', {
            platforms: message.statusReport.platforms.length,
            targets: message.statusReport.targets.length
          });
          
          // DEBUG 级别：详细打印反序列化内容
          if (LOG_LEVEL === LogLevel.DEBUG) {
            logger.debug('[ZMQ]', 'StatusReport full content:', {
              platforms: message.statusReport.platforms.map((p, i) => ({
                index: i,
                id: p.id,
                role: p.role,
                pos: p.pos,
                alive: p.alive,
                hitProb: p.hitProb,
                cost: p.cost,
                maxRange: p.maxRange,
                maxTargets: p.maxTargets,
                quantity: p.quantity,
                ammo: p.ammo,
                targetTypes: p.targetTypes,
                platformType: p.platformType,
                fuel: p.fuel,
                damage: p.damage,
                magazines: p.magazines?.map(m => ({
                  name: m.name,
                  ammoCount: m.ammoCount,
                  loaded: m.loaded,
                  type: m.type,
                  location: m.location
                }))
              })),
              targets: message.statusReport.targets.map((t, i) => ({
                index: i,
                id: t.id,
                kind: t.kind,
                pos: t.pos,
                alive: t.alive,
                value: t.value,
                tier: t.tier,
                prerequisiteTargets: t.prerequisiteTargets,
                targetType: t.targetType
              }))
            });
          }
          
          // 检测数据是否变化
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
                logger.info('[ZMQ]', `Platform #1 moved ${distMoved.toFixed(2)}m`, {
                  old: `(${oldPos.x.toFixed(1)}, ${oldPos.y.toFixed(1)})`,
                  new: `(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)})`
                });
              } else {
                logger.debug('[ZMQ]', `Platform #1 position unchanged (dist=${distMoved.toFixed(4)}m)`);
              }
            }
          } else {
            dataChanged = true;
            logger.info('[ZMQ]', `Platform count changed (${latestData.platforms.length} -> ${message.statusReport.platforms.length})`);
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
          logger.info('[ZMQ]', 'Type: PlanRequest', {
            reason: message.planRequest.reason,
            platforms: message.planRequest.platforms.length,
            targets: message.planRequest.targets.length
          });
          
          // DEBUG 级别：详细打印反序列化内容
          if (LOG_LEVEL === LogLevel.DEBUG) {
            logger.debug('[ZMQ]', 'PlanRequest full content:', {
              reason: message.planRequest.reason,
              platforms: message.planRequest.platforms.map((p, i) => ({
                index: i,
                id: p.id,
                role: p.role,
                pos: p.pos,
                alive: p.alive,
                hitProb: p.hitProb,
                cost: p.cost,
                maxRange: p.maxRange,
                maxTargets: p.maxTargets,
                quantity: p.quantity,
                ammo: p.ammo,
                targetTypes: p.targetTypes,
                platformType: p.platformType,
                fuel: p.fuel,
                damage: p.damage,
                magazines: p.magazines?.map(m => ({
                  name: m.name,
                  ammoCount: m.ammoCount,
                  loaded: m.loaded,
                  type: m.type,
                  location: m.location
                }))
              })),
              targets: message.planRequest.targets.map((t, i) => ({
                index: i,
                id: t.id,
                kind: t.kind,
                pos: t.pos,
                alive: t.alive,
                value: t.value,
                tier: t.tier,
                prerequisiteTargets: t.prerequisiteTargets,
                targetType: t.targetType
              }))
            });
          }
          
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
          logger.info('[ZMQ]', 'Type: EntityKilled', {
            entityType: message.entityKilled.entityType,
            entityId: message.entityKilled.entityId
          });
          
          // DEBUG 级别：详细打印反序列化内容
          if (LOG_LEVEL === LogLevel.DEBUG) {
            logger.debug('[ZMQ]', 'EntityKilled full content:', message.entityKilled);
          }
          
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
          logger.info('[ZMQ]', 'Type: Damage', {
            entityType: message.damage.entityType,
            entityId: message.damage.entityId,
            damageAmount: message.damage.damageAmount
          });
          
          // DEBUG 级别：详细打印反序列化内容
          if (LOG_LEVEL === LogLevel.DEBUG) {
            logger.debug('[ZMQ]', 'Damage full content:', message.damage);
          }
          
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
          logger.info('[ZMQ]', 'Type: Fired', {
            platformId: message.fired.platformId,
            targetId: message.fired.targetId
          });
          
          // DEBUG 级别：详细打印反序列化内容
          if (LOG_LEVEL === LogLevel.DEBUG) {
            logger.debug('[ZMQ]', 'Fired full content:', message.fired);
          }
          
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
          logger.warn('[ZMQ]', 'Unknown message type (all fields undefined)');
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
        logger.error('[ZMQ]', 'Protobuf decode failed', {
          error: String(parseError),
          bufferLength: buffer.length,
          firstBytes: buffer.subarray(0, Math.min(32, buffer.length)).toString('hex')
        });
        
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
      logger.error('[ZMQ]', 'ZMQ receiver error', error);
    }
  }
}

// WebSocket广播
function broadcastToClients() {
  if (wsClients.size === 0) {
    logger.debug('[WebSocket]', 'No clients connected, skip broadcast');
    return;
  }

  const message = JSON.stringify(latestData);
  const disconnected: WebSocket[] = [];
  
  // 打印即将发送的数据摘要
  const preview = {
    timestamp: latestData.timestamp,
    platformCount: latestData.platforms.length,
    targetCount: latestData.targets.length,
    messageType: latestData.messageType,
    firstPlatformPos: latestData.platforms[0]?.pos || null
  };
  logger.info('[WebSocket]', `Broadcasting to ${wsClients.size} client(s)`, preview);

  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        logger.error('[WebSocket]', 'Send error', error);
        disconnected.push(client);
      }
    } else {
      disconnected.push(client);
    }
  });

  // 移除断开的客户端
  disconnected.forEach(client => wsClients.delete(client));
  
  if (disconnected.length > 0) {
    logger.warn('[WebSocket]', `Removed ${disconnected.length} disconnected client(s)`);
  }
}

// WebSocket服务器
function startWebSocketServer() {
  const wss = new WebSocketServer({ port: 8765 });
  
  logger.info('[WebSocket]', 'Listening on ws://localhost:8765');

  wss.on('connection', (ws: WebSocket) => {
    wsClients.add(ws);
    logger.info('[WebSocket]', `New client connected (${wsClients.size} total)`);

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
      logger.info('[WebSocket]', `Client disconnected (${wsClients.size} remaining)`);
    });

    ws.on('error', (error) => {
      logger.error('[WebSocket]', 'Client error', error);
      wsClients.delete(ws);
    });
  });

  wss.on('error', (error) => {
    logger.error('[WebSocket]', 'Server error', error);
  });
}

// 主函数
async function main() {
  // 打印启动信息（始终显示）
  console.log('='.repeat(60));
  console.log('WTA Dashboard Server (TypeScript + Protobuf)');
  console.log('='.repeat(60));
  console.log(`Log Level: ${LogLevel[LOG_LEVEL]}`);
  console.log('ZeroMQ endpoint: tcp://127.0.0.1:5555 (Protobuf)');
  console.log('WebSocket endpoint: ws://localhost:8765 (JSON)');
  console.log('='.repeat(60));
  console.log('');
  
  logger.info('[Server]', 'Starting WTA Dashboard Server', {
    logLevel: LogLevel[LOG_LEVEL],
    zmqEndpoint: 'tcp://127.0.0.1:5555',
    wsEndpoint: 'ws://localhost:8765'
  });

  // 启动WebSocket服务器
  startWebSocketServer();

  // 启动ZeroMQ接收器
  await startZmqReceiver();
}

// 优雅退出
process.on('SIGINT', () => {
  logger.info('[Server]', 'Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('[Server]', 'Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// 运行
main().catch((error) => {
  logger.error('[Server]', 'Fatal error', error);
  process.exit(1);
});
