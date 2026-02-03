/**
 * 房主控制器
 * 负责驱动 AI 逻辑、推进游戏阶段
 */

import type { GameState, Phase } from '@/types/game'
import type { RoomState } from '@/lib/storage'
import { getNextNightPhase } from '@/store/game-machine'

/**
 * 房主控制器配置
 */
export interface HostControllerConfig {
  onGameStateUpdate: (gameState: GameState) => Promise<void>
  onPhaseChange: (phase: Phase) => void
  onAIAction: (playerId: string, action: string) => Promise<void>
}

/**
 * 房主控制器
 * 只在房主客户端运行
 */
export class HostController {
  private config: HostControllerConfig
  private isRunning = false
  private currentGameState: GameState | null = null
  private aiActionTimeout: NodeJS.Timeout | null = null

  constructor(config: HostControllerConfig) {
    this.config = config
  }

  /**
   * 开始控制游戏
   */
  start(initialState: GameState): void {
    this.isRunning = true
    this.currentGameState = initialState
    this.processPhase()
  }

  /**
   * 停止控制
   */
  stop(): void {
    this.isRunning = false
    if (this.aiActionTimeout) {
      clearTimeout(this.aiActionTimeout)
      this.aiActionTimeout = null
    }
  }

  /**
   * 更新游戏状态
   */
  updateState(gameState: GameState): void {
    this.currentGameState = gameState
  }

  /**
   * 处理当前阶段
   */
  private async processPhase(): Promise<void> {
    if (!this.isRunning || !this.currentGameState) return

    const phase = this.currentGameState.phase
    console.log('[HostController] Processing phase:', phase)

    switch (phase) {
      case 'SETUP':
        await this.handleSetup()
        break
      case 'NIGHT_START':
        await this.handleNightStart()
        break
      case 'NIGHT_GUARD_ACTION':
      case 'NIGHT_WOLF_ACTION':
      case 'NIGHT_WITCH_ACTION':
      case 'NIGHT_SEER_ACTION':
        await this.handleNightAction()
        break
      case 'NIGHT_RESOLVE':
        await this.handleNightResolve()
        break
      case 'DAY_START':
        await this.handleDayStart()
        break
      case 'DAY_SPEECH':
      case 'DAY_BADGE_SPEECH':
      case 'DAY_PK_SPEECH':
        await this.handleSpeech()
        break
      case 'DAY_VOTE':
      case 'DAY_BADGE_ELECTION':
        await this.handleVote()
        break
      case 'DAY_RESOLVE':
        await this.handleDayResolve()
        break
      case 'GAME_END':
        this.stop()
        break
      default:
        // 其他阶段等待
        break
    }
  }

  /**
   * 处理游戏设置阶段
   */
  private async handleSetup(): Promise<void> {
    // 延迟后进入夜晚
    await this.delay(2000)
    await this.transitionTo('NIGHT_START')
  }

  /**
   * 处理夜晚开始
   */
  private async handleNightStart(): Promise<void> {
    await this.delay(1500)
    const nextPhase = getNextNightPhase('NIGHT_START', this.currentGameState!)
    await this.transitionTo(nextPhase)
  }

  /**
   * 处理夜晚行动
   */
  private async handleNightAction(): Promise<void> {
    if (!this.currentGameState) return

    const phase = this.currentGameState.phase
    const aiPlayers = this.getAIPlayersForPhase(phase)

    // 等待真人玩家操作或超时
    const timeout = 30000 // 30秒超时

    // AI 玩家自动行动
    for (const player of aiPlayers) {
      await this.delay(1000 + Math.random() * 2000)
      await this.executeAIAction(player.playerId, phase)
    }

    // 检查是否所有人完成，然后进入下一阶段
    await this.delay(2000)
    const nextPhase = getNextNightPhase(phase, this.currentGameState)
    await this.transitionTo(nextPhase)
  }

  /**
   * 处理夜晚结算
   */
  private async handleNightResolve(): Promise<void> {
    await this.delay(2000)
    
    // 检查游戏是否结束
    if (this.checkGameEnd()) {
      await this.transitionTo('GAME_END')
      return
    }

    // 进入白天
    await this.transitionTo('DAY_START')
  }

  /**
   * 处理白天开始
   */
  private async handleDayStart(): Promise<void> {
    await this.delay(1500)
    
    // 第一天有警徽竞选
    if (this.currentGameState!.day === 1) {
      await this.transitionTo('DAY_BADGE_SIGNUP')
    } else {
      await this.transitionTo('DAY_SPEECH')
    }
  }

  /**
   * 处理发言阶段
   */
  private async handleSpeech(): Promise<void> {
    if (!this.currentGameState) return

    const currentSeat = this.currentGameState.currentSpeakerSeat
    if (currentSeat === null) {
      // 发言结束，进入投票
      await this.transitionTo('DAY_VOTE')
      return
    }

    const speaker = this.currentGameState.players.find(p => p.seat === currentSeat)
    if (!speaker) return

    // AI 玩家自动发言
    if (!speaker.isHuman) {
      await this.delay(2000 + Math.random() * 3000)
      await this.config.onAIAction(speaker.playerId, 'speech')
    }

    // 等待发言完成后进入下一个发言者
  }

  /**
   * 处理投票阶段
   */
  private async handleVote(): Promise<void> {
    if (!this.currentGameState) return

    const aiPlayers = this.currentGameState.players.filter(p => !p.isHuman && p.alive)

    // AI 玩家自动投票
    for (const player of aiPlayers) {
      await this.delay(500 + Math.random() * 1500)
      await this.config.onAIAction(player.playerId, 'vote')
    }

    // 等待所有投票完成
    await this.delay(3000)
    await this.transitionTo('DAY_RESOLVE')
  }

  /**
   * 处理白天结算
   */
  private async handleDayResolve(): Promise<void> {
    await this.delay(2000)

    // 检查游戏是否结束
    if (this.checkGameEnd()) {
      await this.transitionTo('GAME_END')
      return
    }

    // 进入夜晚
    await this.transitionTo('NIGHT_START')
  }

  /**
   * 获取当前阶段需要行动的 AI 玩家
   */
  private getAIPlayersForPhase(phase: Phase) {
    if (!this.currentGameState) return []

    const roleMap: Record<string, string> = {
      'NIGHT_GUARD_ACTION': 'Guard',
      'NIGHT_WOLF_ACTION': 'Werewolf',
      'NIGHT_WITCH_ACTION': 'Witch',
      'NIGHT_SEER_ACTION': 'Seer',
    }

    const requiredRole = roleMap[phase]
    if (!requiredRole) return []

    return this.currentGameState.players.filter(
      p => !p.isHuman && p.alive && p.role === requiredRole
    )
  }

  /**
   * 执行 AI 行动
   */
  private async executeAIAction(playerId: string, phase: Phase): Promise<void> {
    try {
      await this.config.onAIAction(playerId, phase)
    } catch (error) {
      console.error('[HostController] AI action error:', error)
    }
  }

  /**
   * 阶段转换
   */
  private async transitionTo(phase: Phase): Promise<void> {
    if (!this.currentGameState) return

    this.currentGameState = {
      ...this.currentGameState,
      phase,
    }

    this.config.onPhaseChange(phase)
    await this.config.onGameStateUpdate(this.currentGameState)

    // 继续处理新阶段
    await this.delay(500)
    await this.processPhase()
  }

  /**
   * 检查游戏是否结束
   */
  private checkGameEnd(): boolean {
    if (!this.currentGameState) return false

    const alivePlayers = this.currentGameState.players.filter(p => p.alive)
    const aliveWolves = alivePlayers.filter(p => p.role === 'Werewolf')
    const aliveVillagers = alivePlayers.filter(p => p.role !== 'Werewolf')

    // 狼人全灭
    if (aliveWolves.length === 0) {
      this.currentGameState.winner = 'village'
      return true
    }

    // 狼人数量 >= 好人数量
    if (aliveWolves.length >= aliveVillagers.length) {
      this.currentGameState.winner = 'wolf'
      return true
    }

    return false
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.aiActionTimeout = setTimeout(resolve, ms)
    })
  }
}
