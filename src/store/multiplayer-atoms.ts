/**
 * 联机模式状态 Atoms
 * 与游戏状态机集成
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { RoomState, Player as MultiPlayer, StorageConfig } from '@/lib/storage'
import type { GameState } from '@/types/game'
import { DEFAULT_STORAGE_CONFIG } from '@/lib/storage'

// ============ 联机配置 Atoms ============

// 存储配置（持久化）
export const storageConfigAtom = atomWithStorage<StorageConfig>(
  'wolfcha_storage_config',
  DEFAULT_STORAGE_CONFIG
)

// 玩家 ID（持久化）
export const multiplayerPlayerIdAtom = atomWithStorage<string>(
  'wolfcha_player_id',
  `player-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
)

// 玩家名称（持久化）
export const multiplayerPlayerNameAtom = atomWithStorage<string>(
  'wolfcha_player_name',
  ''
)

// ============ 联机状态 Atoms ============

// 联机模式开关
export const isMultiplayerModeAtom = atom(false)

// 房间状态
export const roomStateAtom = atom<RoomState | null>(null)

// 是否房主
export const isHostAtom = atom((get) => {
  const room = get(roomStateAtom)
  const playerId = get(multiplayerPlayerIdAtom)
  return room?.hostId === playerId
})

// 房间 ID
export const roomIdAtom = atom((get) => {
  const room = get(roomStateAtom)
  return room?.id ?? null
})

// 当前玩家在房间中的信息
export const currentMultiPlayerAtom = atom((get) => {
  const room = get(roomStateAtom)
  const playerId = get(multiplayerPlayerIdAtom)
  return room?.players.find(p => p.id === playerId) ?? null
})

// 所有玩家列表
export const multiPlayersAtom = atom((get) => {
  const room = get(roomStateAtom)
  return room?.players ?? []
})

// 房间状态
export const roomStatusAtom = atom((get) => {
  const room = get(roomStateAtom)
  return room?.status ?? 'waiting'
})

// 是否所有人准备
export const allReadyAtom = atom((get) => {
  const room = get(roomStateAtom)
  if (!room) return false
  return room.players.every(p => p.isReady)
})

// 连接状态
export const connectionStateAtom = atom<{
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}>({
  isConnected: false,
  isConnecting: false,
  error: null,
})

// ============ 联机游戏状态 ============

// 联机游戏状态（从房间同步）
export const multiplayerGameStateAtom = atom<GameState | null>((get) => {
  const room = get(roomStateAtom)
  return room?.gameState as GameState | null ?? null
})

// ============ 玩家座位映射 ============

// 联机玩家到游戏座位的映射
export interface SeatMapping {
  multiPlayerId: string
  multiPlayerName: string
  gameSeat: number
  gamePlayerId: string
}

export const seatMappingsAtom = atom<SeatMapping[]>([])

// 获取当前玩家的游戏座位
export const currentGameSeatAtom = atom((get) => {
  const playerId = get(multiplayerPlayerIdAtom)
  const mappings = get(seatMappingsAtom)
  const mapping = mappings.find(m => m.multiPlayerId === playerId)
  return mapping?.gameSeat ?? null
})

// ============ 操作 Atoms ============

// 设置联机模式
export const setMultiplayerModeAtom = atom(
  null,
  (get, set, enabled: boolean) => {
    set(isMultiplayerModeAtom, enabled)
    if (!enabled) {
      set(roomStateAtom, null)
      set(seatMappingsAtom, [])
    }
  }
)

// 更新房间状态
export const updateRoomStateAtom = atom(
  null,
  (get, set, room: RoomState | null) => {
    set(roomStateAtom, room)
  }
)

// 设置连接状态
export const setConnectionStateAtom = atom(
  null,
  (get, set, state: Partial<{ isConnected: boolean; isConnecting: boolean; error: string | null }>) => {
    set(connectionStateAtom, (prev) => ({ ...prev, ...state }))
  }
)

// 设置座位映射
export const setSeatMappingsAtom = atom(
  null,
  (get, set, mappings: SeatMapping[]) => {
    set(seatMappingsAtom, mappings)
  }
)

// ============ 派生状态 ============

// 是否可以开始游戏（房主 + 所有人准备 + 至少2人）
export const canStartGameAtom = atom((get) => {
  const isHost = get(isHostAtom)
  const allReady = get(allReadyAtom)
  const players = get(multiPlayersAtom)
  return isHost && allReady && players.length >= 2
})

// 联机模式下是否需要等待其他玩家
export const isWaitingForOthersAtom = atom((get) => {
  const isMultiplayer = get(isMultiplayerModeAtom)
  const room = get(roomStateAtom)
  if (!isMultiplayer || !room) return false
  return room.status === 'waiting'
})

// 联机模式下当前轮到谁操作
export const currentTurnPlayerAtom = atom((get) => {
  const gameState = get(multiplayerGameStateAtom)
  if (!gameState) return null
  
  const currentSeat = gameState.currentSpeakerSeat
  if (currentSeat === null) return null
  
  const mappings = get(seatMappingsAtom)
  return mappings.find(m => m.gameSeat === currentSeat) ?? null
})

// 是否轮到当前玩家操作
export const isMyTurnAtom = atom((get) => {
  const currentTurn = get(currentTurnPlayerAtom)
  const playerId = get(multiplayerPlayerIdAtom)
  return currentTurn?.multiPlayerId === playerId
})
