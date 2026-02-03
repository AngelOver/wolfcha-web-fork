'use client'

/**
 * 玩家列表组件
 */

import type { Player } from '@/lib/storage'

interface PlayerListProps {
  players: Player[]
  currentPlayerId?: string | null
  showReadyStatus?: boolean
}

export function PlayerList({ players, currentPlayerId, showReadyStatus = true }: PlayerListProps) {
  return (
    <div className="space-y-2">
      {players.map((player, index) => (
        <div
          key={player.id}
          className={`flex items-center justify-between p-3 rounded-lg ${
            player.id === currentPlayerId
              ? 'bg-blue-900/50 border border-blue-500'
              : 'bg-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* 座位号 */}
            <span className="w-8 h-8 flex items-center justify-center bg-gray-600 rounded-full text-sm font-medium">
              {index + 1}
            </span>
            
            {/* 玩家名称 */}
            <span className="font-medium">
              {player.name}
              {player.id === currentPlayerId && (
                <span className="text-blue-400 text-sm ml-2">(你)</span>
              )}
            </span>
            
            {/* 房主标识 */}
            {player.isHost && (
              <span className="px-2 py-0.5 bg-yellow-600 rounded text-xs font-medium">
                房主
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 在线状态 */}
            <span
              className={`w-2 h-2 rounded-full ${
                player.isOnline ? 'bg-green-500' : 'bg-gray-500'
              }`}
              title={player.isOnline ? '在线' : '离线'}
            />
            
            {/* 准备状态 */}
            {showReadyStatus && (
              <span
                className={`text-sm ${
                  player.isReady ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                {player.isReady ? '✓ 已准备' : '未准备'}
              </span>
            )}
          </div>
        </div>
      ))}

      {players.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          暂无玩家
        </div>
      )}
    </div>
  )
}
