/**
 * 联机模式类型定义
 */

import type { RoomState, Player } from '../storage/interface'

// 重导出
export type { RoomState, Player }

// 玩家操作类型
export type PlayerActionType = 
  | 'ready'
  | 'unready'
  | 'vote'
  | 'speak'
  | 'use_skill'

// 玩家操作
export interface PlayerAction {
  type: PlayerActionType
  playerId: string
  payload?: unknown
  timestamp: number
}

// 联机状态
export interface MultiplayerState {
  isConnected: boolean
  isHost: boolean
  roomId: string | null
  playerId: string | null
  playerName: string | null
  room: RoomState | null
  error: string | null
}

// 联机事件
export type MultiplayerEvent =
  | { type: 'connected'; room: RoomState }
  | { type: 'disconnected' }
  | { type: 'room_updated'; room: RoomState }
  | { type: 'player_joined'; player: Player }
  | { type: 'player_left'; playerId: string }
  | { type: 'game_started' }
  | { type: 'game_ended' }
  | { type: 'error'; message: string }

// 联机回调
export interface MultiplayerCallbacks {
  onRoomUpdate?: (room: RoomState) => void
  onPlayerJoin?: (player: Player) => void
  onPlayerLeave?: (playerId: string) => void
  onGameStart?: () => void
  onGameEnd?: () => void
  onError?: (message: string) => void
}

// 同步配置
export interface SyncConfig {
  waitingInterval: number   // 等待阶段轮询间隔
  playingInterval: number   // 游戏阶段轮询间隔
  idleInterval: number      // 空闲阶段轮询间隔
}

// 默认同步配置
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  waitingInterval: 1000,
  playingInterval: 500,
  idleInterval: 3000,
}

// 玩家 ID 存储键
export const PLAYER_ID_KEY = 'wolfcha_player_id'
export const PLAYER_NAME_KEY = 'wolfcha_player_name'

// 生成玩家 ID
export function generatePlayerId(): string {
  return `player-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
}

// 获取或创建玩家 ID
export function getPlayerId(): string {
  if (typeof window === 'undefined') return generatePlayerId()
  
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = generatePlayerId()
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

// 获取玩家名称
export function getPlayerName(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(PLAYER_NAME_KEY)
}

// 保存玩家名称
export function savePlayerName(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PLAYER_NAME_KEY, name)
}
