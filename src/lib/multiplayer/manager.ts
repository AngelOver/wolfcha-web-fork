/**
 * 联机管理器
 * 管理房间生命周期和玩家操作
 */

import type { IGameStorage, RoomState, Player, StorageConfig } from '../storage/interface'
import { createStorage, generateRoomId } from '../storage/factory'
import { SyncManager } from './sync'
import type { MultiplayerCallbacks, PlayerAction } from './types'
import { getPlayerId, getPlayerName, savePlayerName } from './types'

export class MultiplayerManager {
  private storage: IGameStorage | null = null
  private sync: SyncManager | null = null
  private config: StorageConfig | null = null
  private roomId: string | null = null
  private playerId: string
  private playerName: string | null = null
  private callbacks: MultiplayerCallbacks = {}
  private isHost: boolean = false

  constructor() {
    this.playerId = getPlayerId()
    this.playerName = getPlayerName()
  }

  /**
   * 初始化存储
   */
  async initialize(config: StorageConfig): Promise<{ success: boolean; message: string }> {
    this.config = config
    this.storage = createStorage(config)
    
    const result = await this.storage.testConnection()
    if (result.success) {
      this.roomId = await generateRoomId(config)
    }
    return result
  }

  /**
   * 设置玩家名称
   */
  setPlayerName(name: string): void {
    this.playerName = name
    savePlayerName(name)
  }

  /**
   * 获取房间 ID
   */
  getRoomId(): string | null {
    return this.roomId
  }

  /**
   * 是否是房主
   */
  getIsHost(): boolean {
    return this.isHost
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: MultiplayerCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * 创建房间
   */
  async createRoom(playerName?: string): Promise<RoomState | null> {
    if (!this.storage || !this.roomId) {
      this.callbacks.onError?.('存储未初始化')
      return null
    }

    if (playerName) {
      this.setPlayerName(playerName)
    }

    if (!this.playerName) {
      this.callbacks.onError?.('请设置玩家名称')
      return null
    }

    // 检查房间是否已存在
    const existing = await this.storage.getRoom(this.roomId)
    if (existing && existing.status !== 'ended') {
      this.callbacks.onError?.('房间已存在，请直接加入')
      return null
    }

    const now = Date.now()
    const room: RoomState = {
      id: this.roomId,
      version: 1,
      hostId: this.playerId,
      status: 'waiting',
      players: [
        {
          id: this.playerId,
          name: this.playerName,
          isHost: true,
          isReady: true,
          isOnline: true,
          lastSeen: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }

    const success = await this.storage.saveRoom(room)
    if (!success) {
      this.callbacks.onError?.('创建房间失败')
      return null
    }

    this.isHost = true
    this.startSync(room)
    this.callbacks.onRoomUpdate?.(room)
    return room
  }

  /**
   * 加入房间
   */
  async joinRoom(playerName?: string): Promise<RoomState | null> {
    if (!this.storage || !this.roomId) {
      this.callbacks.onError?.('存储未初始化')
      return null
    }

    if (playerName) {
      this.setPlayerName(playerName)
    }

    if (!this.playerName) {
      this.callbacks.onError?.('请设置玩家名称')
      return null
    }

    const room = await this.storage.getRoom(this.roomId)
    
    // 房间不存在，自动创建
    if (!room) {
      return this.createRoom()
    }

    // 检查是否已在房间中
    const existingPlayer = room.players.find(p => p.id === this.playerId)
    if (existingPlayer) {
      // 更新在线状态
      this.isHost = existingPlayer.isHost
      this.startSync(room)
      await this.updateOnlineStatus(true)
      return room
    }

    // 游戏已开始，不能加入
    if (room.status === 'playing') {
      this.callbacks.onError?.('游戏已开始，无法加入')
      return null
    }

    // 加入房间
    const newPlayer: Player = {
      id: this.playerId,
      name: this.playerName,
      isHost: false,
      isReady: false,
      isOnline: true,
      lastSeen: Date.now(),
    }

    const updatedRoom: RoomState = {
      ...room,
      version: room.version + 1,
      players: [...room.players, newPlayer],
      updatedAt: Date.now(),
    }

    const success = await this.storage.saveRoom(updatedRoom)
    if (!success) {
      this.callbacks.onError?.('加入房间失败')
      return null
    }

    this.isHost = false
    this.startSync(updatedRoom)
    this.callbacks.onRoomUpdate?.(updatedRoom)
    this.callbacks.onPlayerJoin?.(newPlayer)
    return updatedRoom
  }

  /**
   * 离开房间
   */
  async leaveRoom(): Promise<void> {
    if (!this.storage || !this.roomId || !this.sync) return

    this.sync.stop()

    const room = await this.storage.getRoom(this.roomId)
    if (!room) return

    const updatedPlayers = room.players.filter(p => p.id !== this.playerId)

    // 如果是房主离开且还有其他玩家，转移房主
    let newHostId = room.hostId
    if (this.isHost && updatedPlayers.length > 0) {
      updatedPlayers[0].isHost = true
      newHostId = updatedPlayers[0].id
    }

    // 如果房间空了，删除房间
    if (updatedPlayers.length === 0) {
      await this.storage.deleteRoom(this.roomId)
    } else {
      await this.storage.saveRoom({
        ...room,
        version: room.version + 1,
        hostId: newHostId,
        players: updatedPlayers,
        updatedAt: Date.now(),
      })
    }

    this.callbacks.onPlayerLeave?.(this.playerId)
    this.sync = null
    this.isHost = false
  }

  /**
   * 设置准备状态
   */
  async setReady(ready: boolean): Promise<void> {
    if (!this.sync) return

    await this.sync.updateWithLock((room) => ({
      ...room,
      players: room.players.map(p =>
        p.id === this.playerId ? { ...p, isReady: ready } : p
      ),
    }))
  }

  /**
   * 开始游戏（仅房主）
   */
  async startGame(): Promise<boolean> {
    if (!this.isHost || !this.sync) {
      this.callbacks.onError?.('只有房主才能开始游戏')
      return false
    }

    const room = await this.sync.updateWithLock((room) => {
      // 检查所有人是否准备
      const allReady = room.players.every(p => p.isReady)
      if (!allReady) {
        return room // 不更新
      }

      return {
        ...room,
        status: 'playing' as const,
      }
    })

    if (room?.status === 'playing') {
      this.callbacks.onGameStart?.()
      return true
    }

    this.callbacks.onError?.('还有玩家未准备')
    return false
  }

  /**
   * 更新游戏状态（仅房主）
   */
  async updateGameState(gameState: unknown): Promise<boolean> {
    if (!this.isHost || !this.sync) return false

    const room = await this.sync.updateWithLock((room) => ({
      ...room,
      gameState,
    }))

    return room !== null
  }

  /**
   * 提交玩家操作
   */
  async submitAction(action: Omit<PlayerAction, 'playerId' | 'timestamp'>): Promise<boolean> {
    if (!this.sync) return false

    const fullAction: PlayerAction = {
      ...action,
      playerId: this.playerId,
      timestamp: Date.now(),
    }

    // 将操作写入房间状态
    const room = await this.sync.updateWithLock((room) => {
      const actions = (room.gameState as { actions?: PlayerAction[] })?.actions || []
      return {
        ...room,
        gameState: {
          ...(room.gameState as object),
          actions: [...actions, fullAction],
        },
      }
    })

    return room !== null
  }

  /**
   * 结束游戏（仅房主）
   */
  async endGame(): Promise<void> {
    if (!this.isHost || !this.sync) return

    await this.sync.updateWithLock((room) => ({
      ...room,
      status: 'ended' as const,
    }))

    this.callbacks.onGameEnd?.()
  }

  /**
   * 刷新房间数据
   */
  async refresh(): Promise<RoomState | null> {
    return this.sync?.refresh() ?? null
  }

  /**
   * 重连
   */
  async reconnect(): Promise<boolean> {
    if (!this.config || !this.roomId) {
      this.callbacks.onError?.('无法重连：配置丢失')
      return false
    }

    try {
      // 重新初始化存储
      this.storage = createStorage(this.config)
      
      // 获取房间状态
      const room = await this.storage.getRoom(this.roomId)
      if (!room) {
        this.callbacks.onError?.('房间不存在或已关闭')
        return false
      }

      // 检查是否还在房间中
      const player = room.players.find(p => p.id === this.playerId)
      if (!player) {
        // 尝试重新加入
        return (await this.joinRoom()) !== null
      }

      // 恢复同步
      this.isHost = player.isHost
      this.startSync(room)
      
      // 更新在线状态
      await this.updateOnlineStatus(true)
      
      return true
    } catch (error) {
      this.callbacks.onError?.(`重连失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
  }

  /**
   * 检查连接状态
   */
  async checkConnection(): Promise<boolean> {
    if (!this.storage || !this.roomId) return false
    
    try {
      const room = await this.storage.getRoom(this.roomId)
      return room !== null
    } catch {
      return false
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.sync?.stop()
    this.sync = null
    this.storage = null
  }

  // ============ 私有方法 ============

  private startSync(room: RoomState): void {
    if (!this.storage || !this.roomId) return

    this.sync = new SyncManager(this.storage, this.roomId)
    this.sync.setOnUpdate((updatedRoom) => {
      this.callbacks.onRoomUpdate?.(updatedRoom)
      
      // 检测游戏状态变化
      if (room.status !== updatedRoom.status) {
        if (updatedRoom.status === 'playing') {
          this.callbacks.onGameStart?.()
        } else if (updatedRoom.status === 'ended') {
          this.callbacks.onGameEnd?.()
        }
      }
    })
    this.sync.start(room.status)
  }

  private async updateOnlineStatus(online: boolean): Promise<void> {
    if (!this.sync) return

    await this.sync.updateWithLock((room) => ({
      ...room,
      players: room.players.map(p =>
        p.id === this.playerId
          ? { ...p, isOnline: online, lastSeen: Date.now() }
          : p
      ),
    }))
  }
}

// 单例
let instance: MultiplayerManager | null = null

export function getMultiplayerManager(): MultiplayerManager {
  if (!instance) {
    instance = new MultiplayerManager()
  }
  return instance
}

export function resetMultiplayerManager(): void {
  instance?.destroy()
  instance = null
}
