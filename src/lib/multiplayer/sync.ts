/**
 * 联机同步逻辑
 */

import type { IGameStorage, RoomState } from '../storage/interface'
import type { SyncConfig } from './types'
import { DEFAULT_SYNC_CONFIG } from './types'

export class SyncManager {
  private storage: IGameStorage
  private roomId: string
  private config: SyncConfig
  private intervalId: NodeJS.Timeout | null = null
  private lastVersion: number = 0
  private onUpdate: ((room: RoomState) => void) | null = null

  constructor(storage: IGameStorage, roomId: string, config?: Partial<SyncConfig>) {
    this.storage = storage
    this.roomId = roomId
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config }
  }

  /**
   * 设置更新回调
   */
  setOnUpdate(callback: (room: RoomState) => void): void {
    this.onUpdate = callback
  }

  /**
   * 获取当前轮询间隔
   */
  private getInterval(status: RoomState['status']): number {
    switch (status) {
      case 'waiting':
        return this.config.waitingInterval
      case 'playing':
        return this.config.playingInterval
      case 'ended':
        return this.config.idleInterval
      default:
        return this.config.waitingInterval
    }
  }

  /**
   * 开始同步
   */
  start(initialStatus: RoomState['status'] = 'waiting'): void {
    this.stop()
    this.poll(initialStatus)
  }

  /**
   * 停止同步
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * 轮询
   */
  private async poll(status: RoomState['status']): Promise<void> {
    try {
      const room = await this.storage.getRoom(this.roomId)
      
      if (room && room.version > this.lastVersion) {
        this.lastVersion = room.version
        this.onUpdate?.(room)
        status = room.status
      }
    } catch (error) {
      console.error('[SyncManager] Poll error:', error)
    }

    // 安排下次轮询
    const interval = this.getInterval(status)
    this.intervalId = setTimeout(() => this.poll(status), interval)
  }

  /**
   * 强制刷新
   */
  async refresh(): Promise<RoomState | null> {
    try {
      const room = await this.storage.getRoom(this.roomId)
      if (room) {
        this.lastVersion = room.version
        this.onUpdate?.(room)
      }
      return room
    } catch (error) {
      console.error('[SyncManager] Refresh error:', error)
      return null
    }
  }

  /**
   * 乐观锁更新
   * 如果版本不匹配，重试指定次数
   */
  async updateWithLock(
    updater: (room: RoomState) => RoomState,
    maxRetries: number = 3
  ): Promise<RoomState | null> {
    for (let i = 0; i < maxRetries; i++) {
      const room = await this.storage.getRoom(this.roomId)
      if (!room) return null

      const updated = updater({
        ...room,
        version: room.version + 1,
        updatedAt: Date.now(),
      })

      const success = await this.storage.saveRoom(updated)
      if (success) {
        this.lastVersion = updated.version
        this.onUpdate?.(updated)
        return updated
      }

      // 等待一小段时间后重试
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)))
    }

    console.error('[SyncManager] Update failed after retries')
    return null
  }
}
