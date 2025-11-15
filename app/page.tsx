'use client';

import { useEffect, useState, useCallback } from 'react';

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

interface DashboardData {
  timestamp: string | null;
  platforms: PlatformData[];
  targets: TargetData[];
  raw_json: string;
}

export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState<DashboardData>({
    timestamp: null,
    platforms: [],
    targets: [],
    raw_json: ''
  });
  const [ws, setWs] = useState<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    const socket = new WebSocket('ws://localhost:8765');

    socket.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const newData: DashboardData = JSON.parse(event.data);
        setData(newData);
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

  const getRoleEmoji = (role: string) => {
    const map: Record<string, string> = {
      'AntiPersonnel': '💣',
      'AntiArmor': '🚀',
      'MultiRole': '⚡'
    };
    return map[role] || '🚁';
  };

  const getKindEmoji = (kind: string) => {
    const map: Record<string, string> = {
      'Infantry': '🎖️',
      'Armor': '🛡️',
      'SAM': '🎯',
      'Other': '❓'
    };
    return map[kind] || '👤';
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(data.raw_json).then(() => {
      alert('Copied to clipboard!');
    });
  };

  const activePlatforms = data.platforms.filter(p => p.alive).length;
  const totalAmmo = data.platforms.reduce((sum, p) => 
    sum + p.ammo.missile + p.ammo.bomb + p.ammo.rocket, 0
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">🎯 WTA Dashboard</h1>
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 status-online' : 'bg-red-500'}`}></span>
                <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
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

        {/* Platforms Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🚁</span> Platforms (UAVs)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.platforms.length > 0 ? (
              data.platforms.map(p => (
                <div key={p.id} className="platform-card bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-lg font-bold">{getRoleEmoji(p.role)} Platform #{p.id}</div>
                    <span className={`text-xs ${p.alive ? 'bg-green-600' : 'bg-red-600'} px-2 py-1 rounded`}>
                      {p.alive ? 'ALIVE' : 'DEAD'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">{p.role}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>📍 Pos: ({p.pos.x.toFixed(0)}, {p.pos.y.toFixed(0)})</div>
                    <div>🎯 Range: {p.max_range.toFixed(0)}m</div>
                    <div>💥 Hit Prob: {(p.hit_prob * 100).toFixed(0)}%</div>
                    <div>💰 Cost: {p.cost.toFixed(1)}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Ammunition:</div>
                    <div className="flex space-x-3 text-xs">
                      <span>🚀 {p.ammo.missile}</span>
                      <span>💣 {p.ammo.bomb}</span>
                      <span>🔥 {p.ammo.rocket}</span>
                    </div>
                  </div>
                </div>
              ))
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
              data.targets.map(t => (
                <div key={t.id} className="target-card bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold">{getKindEmoji(t.kind)} #{t.id}</div>
                    <span className={`text-xs ${t.alive ? 'bg-red-600' : 'bg-gray-600'} px-2 py-1 rounded`}>
                      {t.alive ? 'ACTIVE' : 'DEAD'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1">{t.kind}</div>
                  <div className="text-sm space-y-1">
                    <div>📍 ({t.pos.x.toFixed(0)}, {t.pos.y.toFixed(0)})</div>
                    <div>💎 Value: {t.value.toFixed(0)}</div>
                    <div>⭐ Tier: {t.tier}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-8 col-span-full">No targets data</div>
            )}
          </div>
        </div>

        {/* Raw JSON View */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <span className="mr-2">📋</span> Raw JSON Data
            </h2>
            <button 
              onClick={copyToClipboard}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
          <pre className="bg-gray-800 p-4 rounded overflow-x-auto text-xs">
            <code>{data.raw_json || 'Waiting for data...'}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
