'use client';

import { useEffect, useRef, useState } from 'react';
import { PlatformState, TargetState, getRoleEmoji, getKindEmoji } from '../types';

interface TacticalMapProps {
  platforms: PlatformState[];
  targets: TargetState[];
  isUpdating: boolean;
}

export default function TacticalMap({ platforms, targets, isUpdating }: TacticalMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredUnit, setHoveredUnit] = useState<{type: 'platform' | 'target', id: number} | null>(null);
  const [dpr, setDpr] = useState(1);

  // 设置设备像素比
  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
  }, []);

  // 计算地图边界
  const getBounds = () => {
    const allUnits = [
      ...platforms.map(p => p.pos || { x: 0, y: 0 }),
      ...targets.map(t => t.pos || { x: 0, y: 0 })
    ];

    if (allUnits.length === 0) {
      return { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
    }

    const minX = Math.min(...allUnits.map(u => u.x));
    const maxX = Math.max(...allUnits.map(u => u.x));
    const minY = Math.min(...allUnits.map(u => u.y));
    const maxY = Math.max(...allUnits.map(u => u.y));

    // 添加边距
    const padding = 500;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  };

  // 世界坐标转画布坐标
  const worldToCanvas = (x: number, y: number, bounds: any, canvasWidth: number, canvasHeight: number) => {
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    
    // 计算缩放比例（保持宽高比）
    const scaleX = (canvasWidth - 40) / worldWidth;
    const scaleY = (canvasHeight - 40) / worldHeight;
    const baseScale = Math.min(scaleX, scaleY);
    
    const canvasX = ((x - bounds.minX) * baseScale * scale) + 20 + offset.x;
    const canvasY = ((y - bounds.minY) * baseScale * scale) + 20 + offset.y;
    
    return { x: canvasX, y: canvasY };
  };

  // 画布坐标转世界坐标
  const canvasToWorld = (canvasX: number, canvasY: number, bounds: any, canvasWidth: number, canvasHeight: number) => {
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    
    const scaleX = (canvasWidth - 40) / worldWidth;
    const scaleY = (canvasHeight - 40) / worldHeight;
    const baseScale = Math.min(scaleX, scaleY);
    
    const worldX = ((canvasX - 20 - offset.x) / (baseScale * scale)) + bounds.minX;
    const worldY = ((canvasY - 20 - offset.y) / (baseScale * scale)) + bounds.minY;
    
    return { x: worldX, y: worldY };
  };

  // 绘制地图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置高分辨率 Canvas
    const displayWidth = 1000;
    const displayHeight = 600;
    
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    // 缩放所有绘制操作
    ctx.scale(dpr, dpr);

    const bounds = getBounds();
    const width = displayWidth;
    const height = displayHeight;

    // 清空画布
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    // 绘制网格
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    const gridSize = 1000; // 1000m 网格
    
    for (let x = Math.floor(bounds.minX / gridSize) * gridSize; x <= bounds.maxX; x += gridSize) {
      const pos = worldToCanvas(x, bounds.minY, bounds, width, height);
      const pos2 = worldToCanvas(x, bounds.maxY, bounds, width, height);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
    }
    
    for (let y = Math.floor(bounds.minY / gridSize) * gridSize; y <= bounds.maxY; y += gridSize) {
      const pos = worldToCanvas(bounds.minX, y, bounds, width, height);
      const pos2 = worldToCanvas(bounds.maxX, y, bounds, width, height);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
    }

    // 绘制目标（红色方块）
    targets.forEach(target => {
      if (!target.alive) return;
      
      const pos = target.pos || { x: 0, y: 0 };
      const canvasPos = worldToCanvas(pos.x, pos.y, bounds, width, height);
      
      const isHovered = hoveredUnit?.type === 'target' && hoveredUnit?.id === target.id;
      const size = isHovered ? 12 : 8;
      
      // 绘制方块
      ctx.fillStyle = isHovered ? '#ef4444' : '#dc2626';
      ctx.fillRect(canvasPos.x - size/2, canvasPos.y - size/2, size, size);
      
      // 绘制边框
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.strokeRect(canvasPos.x - size/2, canvasPos.y - size/2, size, size);
      
      // 绘制ID
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`T${target.id}`, canvasPos.x, canvasPos.y - size/2 - 5);
      
      // 如果悬停，显示详细信息
      if (isHovered) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(canvasPos.x + 15, canvasPos.y - 30, 150, 60);
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Target #${target.id}`, canvasPos.x + 20, canvasPos.y - 15);
        ctx.fillText(`Type: ${target.targetType || 'Unknown'}`, canvasPos.x + 20, canvasPos.y);
        ctx.fillText(`Value: ${target.value}`, canvasPos.x + 20, canvasPos.y + 15);
      }
    });

    // 绘制平台（蓝色圆圈）
    platforms.forEach(platform => {
      if (!platform.alive) return;
      
      const pos = platform.pos || { x: 0, y: 0 };
      const canvasPos = worldToCanvas(pos.x, pos.y, bounds, width, height);
      
      const isHovered = hoveredUnit?.type === 'platform' && hoveredUnit?.id === platform.id;
      const radius = isHovered ? 10 : 6;
      
      // 绘制攻击范围圆圈（半透明）
      if (isHovered) {
        const rangePos = worldToCanvas(pos.x + platform.maxRange, pos.y, bounds, width, height);
        const rangeRadius = Math.abs(rangePos.x - canvasPos.x);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, rangeRadius, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      // 绘制平台圆圈
      ctx.fillStyle = isHovered ? '#3b82f6' : '#2563eb';
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // 绘制边框
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
      
      // 绘制ID
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${platform.id}`, canvasPos.x, canvasPos.y + radius + 12);
      
      // 如果悬停，显示详细信息
      if (isHovered) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(canvasPos.x + 15, canvasPos.y - 40, 160, 75);
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Platform #${platform.id}`, canvasPos.x + 20, canvasPos.y - 25);
        ctx.fillText(`Type: ${platform.platformType || 'Unknown'}`, canvasPos.x + 20, canvasPos.y - 10);
        ctx.fillText(`Range: ${platform.maxRange.toFixed(0)}m`, canvasPos.x + 20, canvasPos.y + 5);
        const ammo = platform.ammo || { missile: 0, bomb: 0, rocket: 0 };
        ctx.fillText(`Ammo: M${ammo.missile} B${ammo.bomb} R${ammo.rocket}`, canvasPos.x + 20, canvasPos.y + 20);
      }
    });

    // 绘制更新指示器
    if (isUpdating) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.fillRect(0, 0, width, height);
    }

    // 绘制图例
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 150, 80);
    
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(25, 30, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Platforms (UAVs)', 35, 35);
    
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(20, 45, 10, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Targets', 35, 55);
    
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.fillText(`Scale: ${scale.toFixed(1)}x`, 20, 75);

  }, [platforms, targets, scale, offset, isUpdating, hoveredUnit, dpr]);

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else {
      // 检测悬停
      const bounds = getBounds();
      let found = false;

      // 检查平台
      for (const platform of platforms) {
        if (!platform.alive) continue;
        const pos = platform.pos || { x: 0, y: 0 };
        const canvasPos = worldToCanvas(pos.x, pos.y, bounds, canvas.width, canvas.height);
        const dist = Math.sqrt(Math.pow(mouseX - canvasPos.x, 2) + Math.pow(mouseY - canvasPos.y, 2));
        if (dist < 10) {
          setHoveredUnit({ type: 'platform', id: platform.id });
          found = true;
          break;
        }
      }

      if (!found) {
        // 检查目标
        for (const target of targets) {
          if (!target.alive) continue;
          const pos = target.pos || { x: 0, y: 0 };
          const canvasPos = worldToCanvas(pos.x, pos.y, bounds, canvas.width, canvas.height);
          if (Math.abs(mouseX - canvasPos.x) < 8 && Math.abs(mouseY - canvasPos.y) < 8) {
            setHoveredUnit({ type: 'target', id: target.id });
            found = true;
            break;
          }
        }
      }

      if (!found) {
        setHoveredUnit(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.5, Math.min(5, prev * delta)));
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full border border-gray-700 rounded cursor-move"
        style={{ maxWidth: '100%', height: 'auto' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      {/* 控制按钮 */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
        <button
          onClick={() => setScale(prev => Math.min(5, prev * 1.2))}
          className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm transition-colors"
          title="Zoom In"
        >
          🔍+
        </button>
        <button
          onClick={() => setScale(prev => Math.max(0.5, prev * 0.8))}
          className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm transition-colors"
          title="Zoom Out"
        >
          🔍-
        </button>
        <button
          onClick={handleReset}
          className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm transition-colors"
          title="Reset View"
        >
          🎯
        </button>
      </div>

      {/* 提示信息 */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-70 px-3 py-2 rounded text-xs">
        <div>🖱️ Drag to pan</div>
        <div>🖱️ Scroll to zoom</div>
        <div>👆 Hover for details</div>
      </div>
    </div>
  );
}
