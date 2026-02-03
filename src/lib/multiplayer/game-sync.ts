/**
 * 联机游戏同步逻辑
 * 处理游戏状态在多个客户端间的同步
 */

import type { GameState, Player, Role } from '@/types/game'
import type { RoomState, Player as MultiPlayer } from '@/lib/storage'
import type { SeatMapping } from '@/store/multiplayer-atoms'
import { createInitialGameState } from '@/lib/game-master'

/**
 * 将联机玩家映射到游戏座位
 */
export function createSeatMappings(multiPlayers: MultiPlayer[], playerCount: number): SeatMapping[] {
  const mappings: SeatMapping[] = []
  
  // 按加入顺序分配座位
  multiPlayers.forEach((mp, index) => {
    if (index < playerCount) {
      mappings.push({
        multiPlayerId: mp.id,
        multiPlayerName: mp.name,
        gameSeat: index + 1, // 座位从1开始
        gamePlayerId: `player-${index + 1}`,
      })
    }
  })
  
  return mappings
}

/**
 * 创建联机游戏初始状态
 * 根据联机玩家数量生成游戏
 */
export function createMultiplayerGameState(
  multiPlayers: MultiPlayer[],
  seatMappings: SeatMapping[],
  options?: {
    difficulty?: 'easy' | 'normal' | 'hard'
  }
): GameState {
  const playerCount = multiPlayers.length
  
  // 根据玩家数量分配角色
  const roles = assignRoles(playerCount)
  
  // 创建基础游戏状态
  const baseState = createInitialGameState()
  
  // 创建玩家列表
  const players: Player[] = seatMappings.map((mapping, index) => {
    const role = roles[index]
    return {
      playerId: mapping.gamePlayerId,
      seat: mapping.gameSeat,
      displayName: mapping.multiPlayerName,
      alive: true,
      role,
      alignment: getAlignment(role),
      isHuman: true, // 联机模式所有人都是真人
    }
  })
  
  // 如果玩家数不足，补充 AI 玩家
  const totalSeats = Math.max(playerCount, 6) // 最少6人
  for (let i = players.length; i < totalSeats; i++) {
    const seat = i + 1
    const role = roles[i] || 'Villager'
    players.push({
      playerId: `ai-${seat}`,
      seat,
      displayName: `AI玩家${seat}`,
      alive: true,
      role,
      alignment: getAlignment(role),
      isHuman: false,
    })
  }
  
  return {
    ...baseState,
    difficulty: options?.difficulty || 'normal',
    players,
    phase: 'SETUP',
  }
}

/**
 * 根据玩家数量分配角色
 */
function assignRoles(playerCount: number): Role[] {
  // 基础角色配置
  const configs: Record<number, Role[]> = {
    4: ['Werewolf', 'Seer', 'Villager', 'Villager'],
    5: ['Werewolf', 'Seer', 'Witch', 'Villager', 'Villager'],
    6: ['Werewolf', 'Werewolf', 'Seer', 'Witch', 'Villager', 'Villager'],
    7: ['Werewolf', 'Werewolf', 'Seer', 'Witch', 'Hunter', 'Villager', 'Villager'],
    8: ['Werewolf', 'Werewolf', 'Seer', 'Witch', 'Hunter', 'Guard', 'Villager', 'Villager'],
    9: ['Werewolf', 'Werewolf', 'Werewolf', 'Seer', 'Witch', 'Hunter', 'Guard', 'Villager', 'Villager'],
    10: ['Werewolf', 'Werewolf', 'Werewolf', 'Seer', 'Witch', 'Hunter', 'Guard', 'Villager', 'Villager', 'Villager'],
    11: ['Werewolf', 'Werewolf', 'Werewolf', 'Seer', 'Witch', 'Hunter', 'Guard', 'Villager', 'Villager', 'Villager', 'Villager'],
    12: ['Werewolf', 'Werewolf', 'Werewolf', 'Werewolf', 'Seer', 'Witch', 'Hunter', 'Guard', 'Villager', 'Villager', 'Villager', 'Villager'],
  }
  
  const count = Math.min(Math.max(playerCount, 4), 12)
  const roles = configs[count] || configs[6]
  
  // 随机打乱
  return shuffleArray([...roles])
}

/**
 * 获取角色阵营
 */
function getAlignment(role: Role): 'village' | 'wolf' {
  return role === 'Werewolf' ? 'wolf' : 'village'
}

/**
 * 数组随机打乱
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * 玩家操作类型
 */
export type GameAction =
  | { type: 'speech'; playerId: string; content: string }
  | { type: 'vote'; playerId: string; targetSeat: number }
  | { type: 'night_action'; playerId: string; targetSeat?: number; action?: string }
  | { type: 'ready'; playerId: string }
  | { type: 'skip'; playerId: string }

/**
 * 联机游戏状态（包含操作队列）
 */
export interface MultiplayerGameData {
  gameState: GameState
  pendingActions: GameAction[]
  lastActionTime: number
  hostId: string
}

/**
 * 应用玩家操作到游戏状态
 */
export function applyAction(
  gameData: MultiplayerGameData,
  action: GameAction
): MultiplayerGameData {
  return {
    ...gameData,
    pendingActions: [...gameData.pendingActions, action],
    lastActionTime: Date.now(),
  }
}

/**
 * 检查是否所有需要的玩家都已操作
 */
export function checkAllActionsComplete(
  gameState: GameState,
  pendingActions: GameAction[],
  requiredPlayerIds: string[]
): boolean {
  const actionPlayerIds = new Set(pendingActions.map(a => a.playerId))
  return requiredPlayerIds.every(id => actionPlayerIds.has(id))
}

/**
 * 获取当前阶段需要操作的玩家
 */
export function getRequiredPlayers(gameState: GameState): string[] {
  const phase = gameState.phase
  const alivePlayers = gameState.players.filter(p => p.alive)
  
  switch (phase) {
    case 'NIGHT_WOLF_ACTION':
      return alivePlayers
        .filter(p => p.role === 'Werewolf')
        .map(p => p.playerId)
    
    case 'NIGHT_SEER_ACTION':
      return alivePlayers
        .filter(p => p.role === 'Seer')
        .map(p => p.playerId)
    
    case 'NIGHT_WITCH_ACTION':
      return alivePlayers
        .filter(p => p.role === 'Witch')
        .map(p => p.playerId)
    
    case 'NIGHT_GUARD_ACTION':
      return alivePlayers
        .filter(p => p.role === 'Guard')
        .map(p => p.playerId)
    
    case 'DAY_SPEECH':
    case 'DAY_BADGE_SPEECH':
    case 'DAY_PK_SPEECH':
      const speaker = gameState.currentSpeakerSeat
      if (speaker === null) return []
      const speakerPlayer = alivePlayers.find(p => p.seat === speaker)
      return speakerPlayer ? [speakerPlayer.playerId] : []
    
    case 'DAY_VOTE':
    case 'DAY_BADGE_ELECTION':
      return alivePlayers.map(p => p.playerId)
    
    default:
      return []
  }
}
