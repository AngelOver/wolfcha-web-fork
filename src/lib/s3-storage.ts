/**
 * S3 兼容存储工具类
 * 支持七牛云、阿里云 OSS、腾讯云 COS 等
 * 使用 AWS Signature V4 签名
 */

export interface S3Config {
  endpoint: string      // 如: s3.cn-east-1.qiniucs.com
  accessKey: string
  secretKey: string
  bucket: string
  region?: string       // 如: cn-east-1
}

// 预设服务商配置
export const S3_PROVIDERS = {
  qiniu: {
    name: '七牛云',
    endpoint: 's3.cn-east-1.qiniucs.com',
    region: 'cn-east-1',
  },
  aliyun: {
    name: '阿里云 OSS',
    endpoint: 'oss-cn-hangzhou.aliyuncs.com',
    region: 'cn-hangzhou',
  },
  tencent: {
    name: '腾讯云 COS',
    endpoint: 'cos.ap-shanghai.myqcloud.com',
    region: 'ap-shanghai',
  },
} as const

export type S3Provider = keyof typeof S3_PROVIDERS

// ============ AWS Signature V4 签名工具 ============

async function hmacSHA256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function getAmzDate(): { amzDate: string; dateStamp: string } {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)
  return { amzDate, dateStamp }
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSHA256('AWS4' + secretKey, dateStamp)
  const kRegion = await hmacSHA256(kDate, region)
  const kService = await hmacSHA256(kRegion, service)
  return hmacSHA256(kService, 'aws4_request')
}

interface SignedRequest {
  url: string
  headers: Record<string, string>
}

async function signRequest(
  method: string,
  host: string,
  path: string,
  headers: Record<string, string>,
  body: string,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string = 's3'
): Promise<SignedRequest> {
  const { amzDate, dateStamp } = getAmzDate()
  const payloadHash = await sha256(body)

  const allHeaders: Record<string, string> = {
    ...headers,
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  }

  const signedHeaders = Object.keys(allHeaders)
    .map(k => k.toLowerCase())
    .sort()
    .join(';')

  const canonicalHeaders = Object.keys(allHeaders)
    .map(k => k.toLowerCase())
    .sort()
    .map(k => `${k}:${allHeaders[k.split('-').map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('-')] || allHeaders[k]}`)
    .join('\n') + '\n'

  const canonicalHeadersFixed = Object.entries(allHeaders)
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
    .sort()
    .join('\n') + '\n'

  const canonicalRequest = [
    method,
    path,
    '', // query string
    canonicalHeadersFixed,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n')

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service)
  const signature = toHex(await hmacSHA256(signingKey, stringToSign))

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    url: `https://${host}${path}`,
    headers: {
      ...headers,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorization,
    },
  }
}

// ============ S3 存储类 ============

export class S3Storage {
  private config: S3Config

  constructor(config: S3Config) {
    this.config = config
  }

  private get host(): string {
    return `${this.config.bucket}.${this.config.endpoint}`
  }

  private get region(): string {
    return this.config.region || 'us-east-1'
  }

  getPublicUrl(key: string): string {
    return `https://${this.host}/${key}`
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const path = `/${key}`
      const signed = await signRequest(
        'GET',
        this.host,
        path,
        {},
        '',
        this.config.accessKey,
        this.config.secretKey,
        this.region
      )

      const res = await fetch(signed.url, {
        method: 'GET',
        headers: signed.headers,
        cache: 'no-store',
      })

      if (!res.ok) {
        if (res.status === 404) return null
        const text = await res.text()
        console.error('[S3Storage] GET error:', res.status, text)
        throw new Error(`GET failed: ${res.status}`)
      }
      return await res.json()
    } catch (error) {
      console.error('[S3Storage] getJSON error:', error)
      return null
    }
  }

  async putJSON(key: string, data: unknown): Promise<boolean> {
    try {
      const path = `/${key}`
      const body = JSON.stringify(data)
      
      const signed = await signRequest(
        'PUT',
        this.host,
        path,
        { 'Content-Type': 'application/json' },
        body,
        this.config.accessKey,
        this.config.secretKey,
        this.region
      )

      const res = await fetch(signed.url, {
        method: 'PUT',
        headers: signed.headers,
        body,
      })

      if (!res.ok) {
        const text = await res.text()
        console.error('[S3Storage] PUT error:', res.status, text)
      }
      return res.ok
    } catch (error) {
      console.error('[S3Storage] putJSON error:', error)
      return false
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const path = `/${key}`
      const signed = await signRequest(
        'DELETE',
        this.host,
        path,
        {},
        '',
        this.config.accessKey,
        this.config.secretKey,
        this.region
      )

      const res = await fetch(signed.url, {
        method: 'DELETE',
        headers: signed.headers,
      })
      return res.ok || res.status === 404
    } catch (error) {
      console.error('[S3Storage] delete error:', error)
      return false
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const testKey = `_test_${Date.now()}.json`
      const testData = { test: true, timestamp: Date.now() }

      const writeOk = await this.putJSON(testKey, testData)
      if (!writeOk) {
        return { success: false, message: '写入测试失败，请检查密钥和权限' }
      }

      const readData = await this.getJSON<typeof testData>(testKey)
      if (!readData || readData.timestamp !== testData.timestamp) {
        return { success: false, message: '读取测试失败' }
      }

      await this.delete(testKey)
      return { success: true, message: '连接成功！' }
    } catch (error) {
      return {
        success: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }
}

/**
 * 房间数据结构
 */
export interface RoomData {
  id: string
  hostId: string
  players: Array<{
    id: string
    name: string
    seat?: number
    isReady: boolean
  }>
  gameState?: unknown
  updatedAt: number
  createdAt: number
}

/**
 * 房间管理器
 */
export class RoomManager {
  private storage: S3Storage
  private roomPrefix = 'rooms/'

  constructor(storage: S3Storage) {
    this.storage = storage
  }

  private getRoomKey(roomId: string): string {
    return `${this.roomPrefix}${roomId}.json`
  }

  /**
   * 创建房间
   */
  async createRoom(roomId: string, hostId: string, hostName: string): Promise<RoomData> {
    const room: RoomData = {
      id: roomId,
      hostId,
      players: [{ id: hostId, name: hostName, isReady: true }],
      updatedAt: Date.now(),
      createdAt: Date.now(),
    }
    await this.storage.putJSON(this.getRoomKey(roomId), room)
    return room
  }

  /**
   * 获取房间
   */
  async getRoom(roomId: string): Promise<RoomData | null> {
    return this.storage.getJSON<RoomData>(this.getRoomKey(roomId))
  }

  /**
   * 更新房间
   */
  async updateRoom(roomId: string, updater: (room: RoomData) => RoomData): Promise<RoomData | null> {
    const room = await this.getRoom(roomId)
    if (!room) return null
    
    const updated = updater({ ...room, updatedAt: Date.now() })
    await this.storage.putJSON(this.getRoomKey(roomId), updated)
    return updated
  }

  /**
   * 加入房间
   */
  async joinRoom(roomId: string, playerId: string, playerName: string): Promise<RoomData | null> {
    return this.updateRoom(roomId, (room) => {
      if (room.players.some(p => p.id === playerId)) return room
      return {
        ...room,
        players: [...room.players, { id: playerId, name: playerName, isReady: false }],
      }
    })
  }

  /**
   * 离开房间
   */
  async leaveRoom(roomId: string, playerId: string): Promise<RoomData | null> {
    return this.updateRoom(roomId, (room) => ({
      ...room,
      players: room.players.filter(p => p.id !== playerId),
    }))
  }

  /**
   * 更新游戏状态
   */
  async updateGameState(roomId: string, gameState: unknown): Promise<boolean> {
    const room = await this.getRoom(roomId)
    if (!room) return false
    
    await this.storage.putJSON(this.getRoomKey(roomId), {
      ...room,
      gameState,
      updatedAt: Date.now(),
    })
    return true
  }
}
