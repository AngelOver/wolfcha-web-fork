/**
 * S3 兼容存储实现
 * 支持七牛云、腾讯云 COS
 * 使用 AWS Signature V4 签名
 */

import type { IGameStorage, StorageConfig, RoomState, ConnectionTestResult } from './interface'

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

  const canonicalHeadersFixed = Object.entries(allHeaders)
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
    .sort()
    .join('\n') + '\n'

  const canonicalRequest = [
    method,
    path,
    '',
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

export class S3Storage implements IGameStorage {
  private config: StorageConfig
  private roomPrefix = 'rooms/'

  constructor(config: StorageConfig) {
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

  private getRoomKey(roomId: string): string {
    return `${this.roomPrefix}${roomId}.json`
  }

  private async getJSON<T>(key: string): Promise<T | null> {
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

  private async putJSON(key: string, data: unknown): Promise<boolean> {
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

  private async deleteJSON(key: string): Promise<boolean> {
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

  // ============ IGameStorage 接口实现 ============

  async getRoom(roomId: string): Promise<RoomState | null> {
    return this.getJSON<RoomState>(this.getRoomKey(roomId))
  }

  async saveRoom(room: RoomState): Promise<boolean> {
    return this.putJSON(this.getRoomKey(room.id), room)
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    return this.deleteJSON(this.getRoomKey(roomId))
  }

  async testConnection(): Promise<ConnectionTestResult> {
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

      await this.deleteJSON(testKey)
      return { success: true, message: '连接成功！' }
    } catch (error) {
      return {
        success: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }
}
