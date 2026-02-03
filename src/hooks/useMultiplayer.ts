/**
 * 联机模式 React Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { StorageConfig, RoomState, Player } from '@/lib/storage'
import { getStorageConfig, saveStorageConfig } from '@/lib/storage'
import { getMultiplayerManager, resetMultiplayerManager } from '@/lib/multiplayer'
import type { MultiplayerState } from '@/lib/multiplayer'

export interface UseMultiplayerReturn {
  // 状态
  state: MultiplayerState
  config: StorageConfig
  
  // 配置操作
  setConfig: (config: StorageConfig) => void
  testConnection: () => Promise<boolean>
  
  // 房间操作
  createRoom: (playerName: string) => Promise<boolean>
  joinRoom: (playerName: string) => Promise<boolean>
  leaveRoom: () => Promise<void>
  
  // 玩家操作
  setReady: (ready: boolean) => Promise<void>
  
  // 房主操作
  startGame: () => Promise<boolean>
  updateGameState: (gameState: unknown) => Promise<boolean>
  endGame: () => Promise<void>
  
  // 工具
  refresh: () => Promise<void>
  reset: () => void
}

const initialState: MultiplayerState = {
  isConnected: false,
  isHost: false,
  roomId: null,
  playerId: null,
  playerName: null,
  room: null,
  error: null,
}

export function useMultiplayer(): UseMultiplayerReturn {
  const [state, setState] = useState<MultiplayerState>(initialState)
  const [config, setConfigState] = useState<StorageConfig>(() => getStorageConfig())
  const managerRef = useRef(getMultiplayerManager())

  // 初始化回调
  useEffect(() => {
    const manager = managerRef.current
    
    manager.setCallbacks({
      onRoomUpdate: (room: RoomState) => {
        setState(prev => ({
          ...prev,
          room,
          isHost: manager.getIsHost(),
        }))
      },
      onPlayerJoin: (player: Player) => {
        console.log('[Multiplayer] Player joined:', player.name)
      },
      onPlayerLeave: (playerId: string) => {
        console.log('[Multiplayer] Player left:', playerId)
      },
      onGameStart: () => {
        console.log('[Multiplayer] Game started')
      },
      onGameEnd: () => {
        console.log('[Multiplayer] Game ended')
      },
      onError: (message: string) => {
        setState(prev => ({ ...prev, error: message }))
      },
    })

    return () => {
      manager.destroy()
    }
  }, [])

  // 设置配置
  const setConfig = useCallback((newConfig: StorageConfig) => {
    setConfigState(newConfig)
    saveStorageConfig(newConfig)
  }, [])

  // 测试连接
  const testConnection = useCallback(async (): Promise<boolean> => {
    const manager = managerRef.current
    setState(prev => ({ ...prev, error: null }))
    
    const result = await manager.initialize(config)
    
    if (result.success) {
      setState(prev => ({
        ...prev,
        isConnected: true,
        roomId: manager.getRoomId(),
      }))
    } else {
      setState(prev => ({ ...prev, error: result.message }))
    }
    
    return result.success
  }, [config])

  // 创建房间
  const createRoom = useCallback(async (playerName: string): Promise<boolean> => {
    const manager = managerRef.current
    setState(prev => ({ ...prev, error: null }))

    // 确保已初始化
    if (!state.isConnected) {
      const connected = await testConnection()
      if (!connected) return false
    }

    const room = await manager.createRoom(playerName)
    
    if (room) {
      setState(prev => ({
        ...prev,
        room,
        isHost: true,
        playerName,
        playerId: room.players[0].id,
      }))
      return true
    }
    
    return false
  }, [state.isConnected, testConnection])

  // 加入房间
  const joinRoom = useCallback(async (playerName: string): Promise<boolean> => {
    const manager = managerRef.current
    setState(prev => ({ ...prev, error: null }))

    // 确保已初始化
    if (!state.isConnected) {
      const connected = await testConnection()
      if (!connected) return false
    }

    const room = await manager.joinRoom(playerName)
    
    if (room) {
      const player = room.players.find(p => p.name === playerName)
      setState(prev => ({
        ...prev,
        room,
        isHost: manager.getIsHost(),
        playerName,
        playerId: player?.id ?? null,
      }))
      return true
    }
    
    return false
  }, [state.isConnected, testConnection])

  // 离开房间
  const leaveRoom = useCallback(async (): Promise<void> => {
    const manager = managerRef.current
    await manager.leaveRoom()
    
    setState(prev => ({
      ...prev,
      room: null,
      isHost: false,
    }))
  }, [])

  // 设置准备状态
  const setReady = useCallback(async (ready: boolean): Promise<void> => {
    const manager = managerRef.current
    await manager.setReady(ready)
  }, [])

  // 开始游戏
  const startGame = useCallback(async (): Promise<boolean> => {
    const manager = managerRef.current
    return manager.startGame()
  }, [])

  // 更新游戏状态
  const updateGameState = useCallback(async (gameState: unknown): Promise<boolean> => {
    const manager = managerRef.current
    return manager.updateGameState(gameState)
  }, [])

  // 结束游戏
  const endGame = useCallback(async (): Promise<void> => {
    const manager = managerRef.current
    await manager.endGame()
  }, [])

  // 刷新
  const refresh = useCallback(async (): Promise<void> => {
    const manager = managerRef.current
    await manager.refresh()
  }, [])

  // 重置
  const reset = useCallback((): void => {
    resetMultiplayerManager()
    managerRef.current = getMultiplayerManager()
    setState(initialState)
  }, [])

  return {
    state,
    config,
    setConfig,
    testConnection,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    updateGameState,
    endGame,
    refresh,
    reset,
  }
}
