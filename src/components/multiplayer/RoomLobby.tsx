'use client'

/**
 * 房间大厅组件
 */

import { useState } from 'react'
import type { RoomState } from '@/lib/storage'
import { PlayerList } from './PlayerList'

interface RoomLobbyProps {
  room: RoomState | null
  roomId: string | null
  playerId: string | null
  isHost: boolean
  isConnected: boolean
  error: string | null
  onCreateRoom: (playerName: string) => Promise<boolean>
  onJoinRoom: (playerName: string) => Promise<boolean>
  onLeaveRoom: () => Promise<void>
  onSetReady: (ready: boolean) => Promise<void>
  onStartGame: () => Promise<boolean>
}

export function RoomLobby({
  room,
  roomId,
  playerId,
  isHost,
  isConnected,
  error,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSetReady,
  onStartGame,
}: RoomLobbyProps) {
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(false)

  const currentPlayer = room?.players.find(p => p.id === playerId)
  const allReady = room?.players.every(p => p.isReady) ?? false
  const canStart = isHost && allReady && (room?.players.length ?? 0) >= 1 // 临时允许单人测试

  const handleJoin = async () => {
    if (!playerName.trim()) return
    setLoading(true)
    await onJoinRoom(playerName.trim())
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!playerName.trim()) return
    setLoading(true)
    await onCreateRoom(playerName.trim())
    setLoading(false)
  }

  const handleToggleReady = async () => {
    if (!currentPlayer) return
    setLoading(true)
    await onSetReady(!currentPlayer.isReady)
    setLoading(false)
  }

  const handleStart = async () => {
    setLoading(true)
    await onStartGame()
    setLoading(false)
  }

  const handleLeave = async () => {
    setLoading(true)
    await onLeaveRoom()
    setLoading(false)
  }

  // 未进入房间
  if (!room) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">联机大厅</h2>

        {!isConnected ? (
          <p className="text-gray-400">请先配置并测试存储连接</p>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">你的昵称</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="输入昵称..."
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                  maxLength={20}
                />
              </div>

              {roomId && (
                <p className="text-sm text-gray-400">
                  房间 ID: <span className="text-blue-400 font-mono">{roomId}</span>
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleJoin}
                  disabled={loading || !playerName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium transition-colors"
                >
                  {loading ? '加入中...' : '加入房间'}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading || !playerName.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-medium transition-colors"
                >
                  {loading ? '创建中...' : '创建房间'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">❌ {error}</p>
            )}
          </>
        )}
      </div>
    )
  }

  // 已进入房间
  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          房间 <span className="text-blue-400 font-mono">{room.id}</span>
        </h2>
        <span className={`px-2 py-1 rounded text-sm ${
          room.status === 'waiting' ? 'bg-yellow-600' :
          room.status === 'playing' ? 'bg-green-600' : 'bg-gray-600'
        }`}>
          {room.status === 'waiting' ? '等待中' :
           room.status === 'playing' ? '游戏中' : '已结束'}
        </span>
      </div>

      {/* 玩家列表 */}
      <div>
        <h3 className="text-lg font-medium mb-2">
          玩家 ({room.players.length})
        </h3>
        <PlayerList
          players={room.players}
          currentPlayerId={playerId}
          showReadyStatus={room.status === 'waiting'}
        />
      </div>

      {/* 操作按钮 */}
      {room.status === 'waiting' && (
        <div className="flex gap-2 pt-2">
          {!isHost && currentPlayer && (
            <button
              onClick={handleToggleReady}
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                currentPlayer.isReady
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-green-600 hover:bg-green-700'
              } disabled:bg-gray-600`}
            >
              {currentPlayer.isReady ? '取消准备' : '准备'}
            </button>
          )}

          {isHost && (
            <button
              onClick={handleStart}
              disabled={loading || !canStart}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-medium transition-colors"
              title={!canStart ? '需要至少2人且全员准备' : ''}
            >
              {loading ? '开始中...' : '开始游戏'}
            </button>
          )}

          <button
            onClick={handleLeave}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded font-medium transition-colors"
          >
            离开
          </button>
        </div>
      )}

      {!allReady && room.status === 'waiting' && (
        <p className="text-sm text-yellow-400">
          ⏳ 等待所有玩家准备...
        </p>
      )}

      {error && (
        <p className="text-red-400 text-sm">❌ {error}</p>
      )}
    </div>
  )
}
