/**
 * Protobuf 使用示例
 * 展示如何在 TypeScript 中编码/解码 protobuf 消息
 */

import {
  WTAMessage,
  StatusReportEvent,
  PlanRequest,
  PlanResponse,
  PlatformRole,
  TargetKind,
} from './generated/wta_messages';

// ==================== 示例1: 解码收到的消息 ====================

function handleReceivedMessage(buffer: Buffer) {
  try {
    // 从二进制数据解码
    const message = WTAMessage.decode(buffer);
    
    // 根据消息类型处理
    if (message.statusReport) {
      console.log('收到战场状态上报:');
      console.log(`  - 平台数量: ${message.statusReport.platforms.length}`);
      console.log(`  - 目标数量: ${message.statusReport.targets.length}`);
      
      // 访问平台数据
      message.statusReport.platforms.forEach(platform => {
        console.log(`  平台 ${platform.id}:`);
        console.log(`    角色: ${PlatformRole[platform.role]}`);
        console.log(`    位置: (${platform.pos?.x}, ${platform.pos?.y})`);
        console.log(`    存活: ${platform.alive}`);
        console.log(`    弹药: 导弹=${platform.ammo?.missile}, 炸弹=${platform.ammo?.bomb}, 火箭=${platform.ammo?.rocket}`);
      });
      
      // 访问目标数据
      message.statusReport.targets.forEach(target => {
        console.log(`  目标 ${target.id}:`);
        console.log(`    类型: ${TargetKind[target.kind]}`);
        console.log(`    位置: (${target.pos?.x}, ${target.pos?.y})`);
        console.log(`    价值: ${target.value}`);
      });
    }
    
    if (message.planRequest) {
      console.log('收到规划请求:');
      console.log(`  - 原因: ${message.planRequest.reason}`);
      console.log(`  - 平台数量: ${message.planRequest.platforms.length}`);
      console.log(`  - 目标数量: ${message.planRequest.targets.length}`);
    }
    
    if (message.planResponse) {
      console.log('收到规划响应:');
      console.log(`  - 状态: ${message.planResponse.status}`);
      console.log(`  - 适应度: ${message.planResponse.bestFitness}`);
      console.log(`  - TTL: ${message.planResponse.ttlSec}秒`);
      
      // 访问分配方案
      Object.entries(message.planResponse.assignment).forEach(([platformId, targetId]) => {
        console.log(`    平台 ${platformId} → 目标 ${targetId}`);
      });
    }
    
  } catch (error) {
    console.error('解码 protobuf 消息失败:', error);
  }
}

// ==================== 示例2: 编码发送的消息 ====================

function createStatusReportMessage(): Buffer {
  // 创建状态上报事件
  const statusReport: StatusReportEvent = {
    timestamp: Date.now() / 1000,
    platforms: [
      {
        id: 1,
        role: PlatformRole.PLATFORM_ROLE_ANTI_PERSONNEL,
        pos: { x: 1000, y: 2000 },
        alive: true,
        hitProb: 0.85,
        cost: 1.0,
        maxRange: 5000,
        maxTargets: 2,
        quantity: 1,
        ammo: {
          missile: 4,
          bomb: 2,
          rocket: 0,
        },
        targetTypes: [1, 2],
      },
    ],
    targets: [
      {
        id: 101,
        kind: TargetKind.TARGET_KIND_INFANTRY,
        pos: { x: 3000, y: 4000 },
        alive: true,
        value: 50.0,
        tier: 1,
      },
    ],
  };
  
  // 包装到 WTAMessage
  const message = WTAMessage.create({
    statusReport,
  });
  
  // 编码为二进制
  const buffer = WTAMessage.encode(message).finish();
  
  return Buffer.from(buffer);
}

function createPlanResponseMessage(): Buffer {
  const planResponse: PlanResponse = {
    status: 'ok',
    timestamp: Date.now() / 1000,
    bestFitness: 95.5,
    assignment: {
      1: 101,  // 平台1 攻击 目标101
      2: 102,  // 平台2 攻击 目标102
    },
    nPlatforms: 2,
    nTargets: 2,
    stats: {
      computationTime: 0.125,
      iterations: 100,
      isValid: true,
      coverageRate: 1.0,
    },
    ttlSec: 5.0,
    errorMsg: '',
  };
  
  const message = WTAMessage.create({
    planResponse,
  });
  
  const buffer = WTAMessage.encode(message).finish();
  
  return Buffer.from(buffer);
}

// ==================== 示例3: JSON 互转（调试用） ====================

function messageToJson(buffer: Buffer): string {
  const message = WTAMessage.decode(buffer);
  const json = WTAMessage.toJSON(message);
  return JSON.stringify(json, null, 2);
}

function messageFromJson(jsonString: string): Buffer {
  const json = JSON.parse(jsonString);
  const message = WTAMessage.fromJSON(json);
  const buffer = WTAMessage.encode(message).finish();
  return Buffer.from(buffer);
}

// ==================== 导出 ====================

export {
  handleReceivedMessage,
  createStatusReportMessage,
  createPlanResponseMessage,
  messageToJson,
  messageFromJson,
};

// ==================== 测试代码 ====================

if (require.main === module) {
  console.log('=== Protobuf 编码/解码测试 ===\n');
  
  // 测试状态上报
  console.log('1. 测试状态上报消息:');
  const statusBuffer = createStatusReportMessage();
  console.log(`   编码后大小: ${statusBuffer.length} bytes`);
  console.log(`   JSON表示:\n${messageToJson(statusBuffer)}\n`);
  handleReceivedMessage(statusBuffer);
  
  console.log('\n2. 测试规划响应消息:');
  const planBuffer = createPlanResponseMessage();
  console.log(`   编码后大小: ${planBuffer.length} bytes`);
  console.log(`   JSON表示:\n${messageToJson(planBuffer)}\n`);
  handleReceivedMessage(planBuffer);
}
