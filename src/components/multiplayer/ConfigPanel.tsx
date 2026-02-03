'use client'

/**
 * 存储配置面板
 */

import { useState } from 'react'
import type { StorageConfig } from '@/lib/storage'
import { PROVIDER_PRESETS } from '@/lib/storage'

interface ConfigPanelProps {
  config: StorageConfig
  onChange: (config: StorageConfig) => void
  onTest: () => Promise<boolean>
  disabled?: boolean
}

// 预设配置模板（用户需自行填写密钥）
const TEST_PRESETS = {
  qiniu: {
    endpoint: 's3.cn-east-1.qiniucs.com',
    accessKey: '',
    secretKey: '',
    bucket: '',
    region: 'cn-east-1',
  },
  tencent: {
    endpoint: 'cos.ap-shanghai.myqcloud.com',
    accessKey: '',
    secretKey: '',
    bucket: '',
    region: 'ap-shanghai',
  },
}

export function ConfigPanel({ config, onChange, onTest, disabled }: ConfigPanelProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleProviderChange = (provider: 'qiniu' | 'tencent') => {
    const preset = TEST_PRESETS[provider]
    onChange({
      ...config,
      provider,
      ...preset,
    })
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const success = await onTest()
      setTestResult({
        success,
        message: success ? '连接成功！' : '连接失败',
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-semibold">存储配置</h2>

      {/* 服务商选择 */}
      <div className="flex gap-2">
        {(Object.keys(PROVIDER_PRESETS) as Array<'qiniu' | 'tencent'>).map((p) => (
          <button
            key={p}
            onClick={() => handleProviderChange(p)}
            disabled={disabled}
            className={`px-4 py-2 rounded text-lg font-medium transition-colors ${
              config.provider === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            } disabled:opacity-50`}
          >
            {PROVIDER_PRESETS[p].name}
          </button>
        ))}
      </div>

      {/* 配置表单 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Endpoint</label>
          <input
            type="text"
            value={config.endpoint}
            onChange={(e) => onChange({ ...config, endpoint: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Bucket</label>
          <input
            type="text"
            value={config.bucket}
            onChange={(e) => onChange({ ...config, bucket: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Access Key</label>
          <input
            type="text"
            value={config.accessKey}
            onChange={(e) => onChange({ ...config, accessKey: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Secret Key</label>
          <input
            type="password"
            value={config.secretKey}
            onChange={(e) => onChange({ ...config, secretKey: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {/* 测试按钮 */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleTest}
          disabled={disabled || testing || !config.bucket || !config.accessKey || !config.secretKey}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-medium transition-colors"
        >
          {testing ? '测试中...' : '测试连接'}
        </button>
        
        {testResult && (
          <span className={testResult.success ? 'text-green-400' : 'text-red-400'}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500">
        提示：所有玩家填写相同的配置，即可进入同一房间
      </p>
    </div>
  )
}
