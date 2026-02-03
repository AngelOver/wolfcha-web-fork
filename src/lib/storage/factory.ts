/**
 * 存储工厂
 * 根据配置创建对应的存储实例
 */

import type { IGameStorage, StorageConfig } from './interface'
import { STORAGE_CONFIG_KEY, DEFAULT_STORAGE_CONFIG } from './interface'
import { S3Storage } from './s3-storage'

/**
 * 创建存储实例
 */
export function createStorage(config: StorageConfig): IGameStorage {
  switch (config.provider) {
    case 'qiniu':
    case 'tencent':
      return new S3Storage(config)
    default:
      return new S3Storage(config)
  }
}

/**
 * 从 localStorage 加载配置
 */
export function loadStorageConfig(): StorageConfig | null {
  if (typeof window === 'undefined') return null
  
  try {
    const saved = localStorage.getItem(STORAGE_CONFIG_KEY)
    if (saved) {
      return JSON.parse(saved) as StorageConfig
    }
  } catch (error) {
    console.error('[Storage] Failed to load config:', error)
  }
  return null
}

/**
 * 保存配置到 localStorage
 */
export function saveStorageConfig(config: StorageConfig): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('[Storage] Failed to save config:', error)
  }
}

/**
 * 清除保存的配置
 */
export function clearStorageConfig(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_CONFIG_KEY)
}

/**
 * 获取配置（优先使用已保存的）
 */
export function getStorageConfig(): StorageConfig {
  return loadStorageConfig() || { ...DEFAULT_STORAGE_CONFIG }
}

/**
 * 生成房间 ID（基于配置哈希）
 * 同一配置会生成相同的房间 ID
 */
export async function generateRoomId(config: StorageConfig): Promise<string> {
  const str = `${config.provider}:${config.bucket}:${config.accessKey}`
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `ROOM-${hashHex.substring(0, 8).toUpperCase()}`
}
