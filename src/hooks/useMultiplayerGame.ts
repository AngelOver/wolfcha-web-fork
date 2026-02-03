/**
 * 联机游戏 Hook
 * 集成联机管理器和游戏状态
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type { GameState } from '@/types/game'
import type { RoomState } from '@/lib/storage'
import { getMultiplayerManager } from '@/lib/multiplayer'
import {
  createMultiplayerGameState,
  createSeatMappings,
} from '@/lib/multiplayer/game-sync'
import { HostController } from '@/lib/multiplayer/host-controller'
import {
  isMultiplayerModeAtom,
  roomStateAtom,
  isHostAtom,
  multiplayerPlayerIdAtom,
  seatMappingsAtom,
  connectionStateAtom,
  storageConfigAtom,
} from '@/store/multiplayer-atoms'
import { gameStateAtom } from '@/store/game-machine'

export function useMultiplayerGame() {
  const [isMultiplayer, setIsMultiplayer] = useAtom(isMultiplayerModeAtom)
  const [room, setRoom] = useAtom(roomStateAtom)
  const [seatMappings, setSeatMappings] = useAtom(seatMappingsAtom)
  const [connectionState, setConnectionState] = useAtom(connectionStateAtom)
  const [config] = useAtom(storageConfigAtom)
  
  const isHost = useAtomValue(isHostAtom)
  const playerId = useAtomValue(multiplayerPlayerIdAtom)
  const setGameState = useSetAtom(gameStateAtom)
  
  const managerRef = useRef(getMultiplayerManager())
  const hostControllerRef = useRef<HostController | null>(null)

  // 初始化联机管理器回调
  useEffect(() => {
    const manager = managerRef.current

    manager.setCallbacks({
      onRoomUpdate: (updatedRoom: RoomState) => {
        setRoom(updatedRoom)
        
        // 同步游戏状态
        if (updatedRoom.gameState) {
          setGameState(updatedRoom.gameState as GameState)
        }
      },
      onGameStart: () => {
        console.log('[MultiplayerGame] Game started')
      },
      onGameEnd: () => {
        console.log('[MultiplayerGame] Game ended')
        hostControllerRef.current?.stop()
      },
      onError: (message: string) => {
        setConnectionState(prev => ({ ...prev, error: message }))
      },
    })

    return () => {
      manager.destroy()
      hostControllerRef.current?.stop()
    }
  }, [setRoom, setGameState, setConnectionState])

  // 初始化连接
  const initialize = useCallback(async (): Promise<boolean> => {
    const manager = managerRef.current
    setConnectionState(prev => ({ ...prev, isConnecting: true, error: null }))

    const result = await manager.initialize(config)

    setConnectionState(prev => ({
      ...prev,
      isConnecting: false,
      isConnected: result.success,
      error: result.success ? null : result.message,
    }))

    if (result.success) {
      setIsMultiplayer(true)
    }

    return result.success
  }, [config, setConnectionState, setIsMultiplayer])

  // 创建房间
  const createRoom = useCallback(async (playerName: string): Promise<boolean> => {
    const manager = managerRef.current

    if (!connectionState.isConnected) {
      const connected = await initialize()
      if (!connected) return false
    }

    const room = await manager.createRoom(playerName)
    return room !== null
  }, [connectionState.isConnected, initialize])

  // 加入房间
  const joinRoom = useCallback(async (playerName: string): Promise<boolean> => {
    const manager = managerRef.current

    if (!connectionState.isConnected) {
      const connected = await initialize()
      if (!connected) return false
    }

    const room = await manager.joinRoom(playerName)
    return room !== null
  }, [connectionState.isConnected, initialize])

  // 离开房间
  const leaveRoom = useCallback(async (): Promise<void> => {
    const manager = managerRef.current
    await manager.leaveRoom()
    setRoom(null)
    setIsMultiplayer(false)
    hostControllerRef.current?.stop()
  }, [setRoom, setIsMultiplayer])

  // 设置准备状态
  const setReady = useCallback(async (ready: boolean): Promise<void> => {
    const manager = managerRef.current
    await manager.setReady(ready)
  }, [])

  // 开始游戏（房主专用）
  const startGame = useCallback(async (): Promise<boolean> => {
    if (!isHost || !room) return false

    const manager = managerRef.current

    // 创建座位映射
    const mappings = createSeatMappings(room.players, room.players.length)
    setSeatMappings(mappings)

    // 创建游戏状态
    const gameState = createMultiplayerGameState(room.players, mappings)

    // 更新房间状态
    const success = await manager.startGame()
    if (!success) return false

    // 更新游戏状态
    await manager.updateGameState(gameState)
    setGameState(gameState)

    // 启动房主控制器
    hostControllerRef.current = new HostController({
      onGameStateUpdate: async (state) => {
        await manager.updateGameState(state)
        setGameState(state)
      },
      onPhaseChange: (phase) => {
        console.log('[HostController] Phase changed to:', phase)
      },
      onAIAction: async (aiPlayerId, action) => {
        console.log('[HostController] AI action:', aiPlayerId, action)
        // TODO: 调用 AI API 生成对话/行动
      },
    })

    hostControllerRef.current.start(gameState)

    return true
  }, [isHost, room, setSeatMappings, setGameState])

  // 提交玩家操作
  const submitAction = useCallback(async (
    type: 'speech' | 'vote' | 'night_action' | 'skip',
    payload?: { content?: string; targetSeat?: number }
  ): Promise<boolean> => {
    const manager = managerRef.current
    
    return manager.submitAction({
      type: type as 'ready', // type cast for now
      payload,
    })
  }, [])

  // 刷新房间
  const refresh = useCallback(async (): Promise<void> => {
    const manager = managerRef.current
    await manager.refresh()
  }, [])

  return {
    // 状态
    isMultiplayer,
    room,
    isHost,
    playerId,
    seatMappings,
    connectionState,
    config,

    // 操作
    initialize,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    submitAction,
    refresh,
  }
}
