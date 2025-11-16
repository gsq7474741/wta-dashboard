/**
 * 前端类型定义 - 与Protobuf生成的类型对齐
 */

// 从生成的Protobuf代码导入（用于参考）
// 这些类型与proto/generated/wta_messages.ts中的类型匹配

export interface Vec2 {
  x: number;
  y: number;
}

export interface AmmoState {
  missile: number;
  bomb: number;
  rocket: number;
}

export interface MagazineDetail {
  name: string;           // 弹夹类名（如 "2Rnd_GBU12_LGB"）
  ammoCount: number;      // 剩余弹药数
  loaded: boolean;        // 是否装载中
  type: number;           // 类型
  location: string;       // 位置（如 "vest", "uniform", "backpack"）
}

export enum PlatformRole {
  UNKNOWN = 0,
  ANTI_PERSONNEL = 1,
  ANTI_ARMOR = 2,
  MULTI_ROLE = 3,
}

export enum TargetKind {
  UNKNOWN = 0,
  INFANTRY = 1,
  ARMOR = 2,
  SAM = 3,
  OTHER = 4,
}

export interface PlatformState {
  id: number;
  role: PlatformRole;
  pos: Vec2 | undefined;
  alive: boolean;
  hitProb: number;  // camelCase (Protobuf生成的格式)
  cost: number;
  maxRange: number;
  maxTargets: number;
  quantity: number;
  ammo: AmmoState | undefined;
  targetTypes: number[];
  platformType?: string;           // 平台类型名称（如 "B_UAV_02_dynamicLoadout_F"）
  magazines?: MagazineDetail[];    // 弹夹详细信息列表
  fuel?: number;                   // 剩余油量 (0.0-1.0)
  damage?: number;                 // 总体损伤 (0.0-1.0, 0=无损伤, 1=完全损毁)
}

export interface TargetState {
  id: number;
  kind: TargetKind;
  pos: Vec2 | undefined;
  alive: boolean;
  value: number;
  tier: number;
  targetType?: string;  // 新增：目标类型名称（如 "Infantry", "Armor"）
  prerequisiteTargets?: number[];  // 新增：前置目标ID列表
}

export interface DashboardData {
  timestamp: string | null;
  platforms: PlatformState[];
  targets: TargetState[];
  messageType: string;  // 'status_report', 'none'
}

// 辅助函数：将枚举转换为显示名称
export function getRoleName(role: PlatformRole): string {
  const names: Record<PlatformRole, string> = {
    [PlatformRole.UNKNOWN]: 'Unknown',
    [PlatformRole.ANTI_PERSONNEL]: 'AntiPersonnel',
    [PlatformRole.ANTI_ARMOR]: 'AntiArmor',
    [PlatformRole.MULTI_ROLE]: 'MultiRole',
  };
  return names[role] || 'Unknown';
}

export function getKindName(kind: TargetKind): string {
  const names: Record<TargetKind, string> = {
    [TargetKind.UNKNOWN]: 'Unknown',
    [TargetKind.INFANTRY]: 'Infantry',
    [TargetKind.ARMOR]: 'Armor',
    [TargetKind.SAM]: 'SAM',
    [TargetKind.OTHER]: 'Other',
  };
  return names[kind] || 'Unknown';
}

export function getRoleEmoji(role: PlatformRole): string {
  const emojis: Record<PlatformRole, string> = {
    [PlatformRole.UNKNOWN]: '🚁',
    [PlatformRole.ANTI_PERSONNEL]: '💣',
    [PlatformRole.ANTI_ARMOR]: '🚀',
    [PlatformRole.MULTI_ROLE]: '⚡',
  };
  return emojis[role] || '🚁';
}

export function getKindEmoji(kind: TargetKind): string {
  const emojis: Record<TargetKind, string> = {
    [TargetKind.UNKNOWN]: '❓',
    [TargetKind.INFANTRY]: '🎖️',
    [TargetKind.ARMOR]: '🛡️',
    [TargetKind.SAM]: '🎯',
    [TargetKind.OTHER]: '❓',
  };
  return emojis[kind] || '👤';
}
