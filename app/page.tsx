'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  DashboardData, 
  PlatformState, 
  TargetState,
  PlatformRole,
  TargetKind,
  getRoleName,
  getKindName,
  getRoleEmoji as getRoleEmojiUtil,
  getKindEmoji as getKindEmojiUtil
} from './types';
import TacticalMap from './components/TacticalMap';

export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState<DashboardData>({
    timestamp: null,
    platforms: [],
    targets: [],
    messageType: 'none'
  });
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateRate, setUpdateRate] = useState(0);
  const [updateTimes, setUpdateTimes] = useState<number[]>([]);
  const [dataAge, setDataAge] = useState(0);

  const connectWebSocket = useCallback(() => {
    const socket = new WebSocket('ws://localhost:8765');

    socket.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const newData: DashboardData = JSON.parse(event.data);
        const now = Date.now();
        
        setData(newData);
        setUpdateCount(prev => prev + 1);
        setLastUpdateTime(new Date());
        
        // 计算更新频率 (保留最近10次更新时间)
        setUpdateTimes(prev => {
          const times = [...prev, now].slice(-10);
          if (times.length >= 2) {
            const timeDiff = (times[times.length - 1] - times[0]) / 1000;
            const rate = (times.length - 1) / timeDiff;
            setUpdateRate(rate);
          }
          return times;
        });
        
        // 触发更新动画
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 300);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      // 3秒后重连
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        connectWebSocket();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = connectWebSocket();
    return cleanup;
  }, [connectWebSocket]);

  // 更新数据新鲜度
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastUpdateTime) {
        const age = (Date.now() - lastUpdateTime.getTime()) / 1000;
        setDataAge(age);
      }
    }, 100); // 每100ms更新一次

    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  // 使用导入的辅助函数
  const getRoleEmoji = (role: PlatformRole) => getRoleEmojiUtil(role);
  const getKindEmoji = (kind: TargetKind) => getKindEmojiUtil(kind);

  const copyDataToClipboard = () => {
    const jsonData = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonData).then(() => {
      alert('Copied to clipboard!');
    });
  };

  const activePlatforms = data.platforms.filter(p => p.alive).length;
  const totalAmmo = data.platforms.reduce((sum, p) => {
    const ammo = p.ammo || { missile: 0, bomb: 0, rocket: 0 };
    return sum + ammo.missile + ammo.bomb + ammo.rocket;
  }, 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">🎯 WTA Dashboard</h1>
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${
                  connected ? 'bg-green-500 status-online' : 'bg-red-500'
                }`}></span>
                <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
              {connected && (
                <div className="flex items-center space-x-3 text-xs">
                  <div className="bg-blue-600 px-2 py-1 rounded">
                    <span className={isUpdating ? 'update-flash' : ''}>📊 Updates: {updateCount}</span>
                  </div>
                  {updateRate > 0 && (
                    <div className="bg-green-600 px-2 py-1 rounded">
                      <span>⚡ {updateRate.toFixed(1)} Hz</span>
                    </div>
                  )}
                  {lastUpdateTime && (
                    <>
                      <div className="text-gray-400">
                        ⏱️ {lastUpdateTime.toLocaleTimeString()}
                      </div>
                      <div className={`px-2 py-1 rounded ${
                        dataAge < 2 ? 'bg-green-700' : 
                        dataAge < 5 ? 'bg-yellow-700' : 
                        'bg-red-700'
                      }`}>
                        <span>🕐 {dataAge.toFixed(1)}s ago</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-400">
              {data.timestamp ? `Last update: ${new Date(data.timestamp).toLocaleTimeString()}` : 'Waiting for data...'}
            </div>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-600 rounded-lg p-4">
            <div className="text-sm opacity-80">Total Platforms</div>
            <div className="text-3xl font-bold">{data.platforms.length}</div>
          </div>
          <div className="bg-red-600 rounded-lg p-4">
            <div className="text-sm opacity-80">Total Targets</div>
            <div className="text-3xl font-bold">{data.targets.length}</div>
          </div>
          <div className="bg-green-600 rounded-lg p-4">
            <div className="text-sm opacity-80">Active UAVs</div>
            <div className="text-3xl font-bold">{activePlatforms}</div>
          </div>
          <div className="bg-yellow-600 rounded-lg p-4">
            <div className="text-sm opacity-80">Total Ammo</div>
            <div className="text-3xl font-bold">{totalAmmo}</div>
          </div>
        </div>

        {/* Tactical Map Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🗺️</span> Tactical Map
          </h2>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <TacticalMap 
              platforms={data.platforms} 
              targets={data.targets}
              isUpdating={isUpdating}
            />
          </div>
        </div>

        {/* Platforms Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🚁</span> Platforms (UAVs)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.platforms.length > 0 ? (
              data.platforms.map(p => {
                const pos = p.pos || { x: 0, y: 0 };
                const ammo = p.ammo || { missile: 0, bomb: 0, rocket: 0 };
                return (
                  <div key={p.id} className={`platform-card bg-gray-800 rounded-lg p-4 border border-gray-700 ${
                    isUpdating ? 'data-update-pulse' : ''
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-lg font-bold">{getRoleEmoji(p.role)} Platform #{p.id}</div>
                      <span className={`text-xs ${p.alive ? 'bg-green-600' : 'bg-red-600'} px-2 py-1 rounded`}>
                        {p.alive ? 'ALIVE' : 'DEAD'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mb-2">{getRoleName(p.role)}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>📍 Pos: ({pos.x.toFixed(0)}, {pos.y.toFixed(0)})</div>
                      <div>🎯 Range: {p.maxRange.toFixed(0)}m</div>
                      <div>💥 Hit Prob: {(p.hitProb * 100).toFixed(0)}%</div>
                      <div>💰 Cost: {p.cost.toFixed(1)}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">Ammunition:</div>
                      <div className="flex space-x-3 text-xs">
                        <span>🚀 {ammo.missile}</span>
                        <span>💣 {ammo.bomb}</span>
                        <span>🔥 {ammo.rocket}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500 text-center py-8 col-span-full">No platforms data</div>
            )}
          </div>
        </div>

        {/* Targets Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🎯</span> Targets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.targets.length > 0 ? (
              data.targets.map(t => {
                const pos = t.pos || { x: 0, y: 0 };
                return (
                  <div key={t.id} className={`target-card bg-gray-800 rounded-lg p-3 border border-gray-700 ${
                    isUpdating ? 'data-update-pulse' : ''
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold">{getKindEmoji(t.kind)} #{t.id}</div>
                      <span className={`text-xs ${t.alive ? 'bg-red-600' : 'bg-gray-600'} px-2 py-1 rounded`}>
                        {t.alive ? 'ACTIVE' : 'DEAD'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-1">{getKindName(t.kind)}</div>
                    <div className="text-sm space-y-1">
                      <div>📍 ({pos.x.toFixed(0)}, {pos.y.toFixed(0)})</div>
                      <div>💎 Value: {t.value.toFixed(0)}</div>
                      <div>⭐ Tier: {t.tier}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500 text-center py-8 col-span-full">No targets data</div>
            )}
          </div>
        </div>

        {/* Data View */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <span className="mr-2">📋</span> Data Summary
            </h2>
            <button 
              onClick={copyDataToClipboard}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition-colors"
            >
              Copy JSON
            </button>
          </div>
          <div className="bg-gray-800 p-4 rounded">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Message Type:</div>
                <div className="font-mono">{data.messageType}</div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Last Update:</div>
                <div className="font-mono">{data.timestamp || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Data Status:</div>
                <div className="font-mono">
                  {data.platforms.length > 0 || data.targets.length > 0 ? '✓ Receiving' : '⏳ Waiting'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
