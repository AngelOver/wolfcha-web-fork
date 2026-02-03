import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameState } from "@/types/game";
import { getApiConfig, saveApiConfig, API_PROVIDERS, type ApiConfig } from "@/lib/api-config";
import { ExternalLink, Eye, EyeOff } from "lucide-react";

interface SoundSettingsSectionProps {
  bgmVolume: number;
  isSoundEnabled: boolean;
  isAiVoiceEnabled: boolean;
  onBgmVolumeChange: (value: number) => void;
  onSoundEnabledChange: (value: boolean) => void;
  onAiVoiceEnabledChange: (value: boolean) => void;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bgmVolume: number;
  isSoundEnabled: boolean;
  isAiVoiceEnabled: boolean;
  gameState: GameState;
  onBgmVolumeChange: (value: number) => void;
  onSoundEnabledChange: (value: boolean) => void;
  onAiVoiceEnabledChange: (value: boolean) => void;
}

export function SoundSettingsSection({
  bgmVolume,
  isSoundEnabled,
  isAiVoiceEnabled,
  onBgmVolumeChange,
  onSoundEnabledChange,
  onAiVoiceEnabledChange,
}: SoundSettingsSectionProps) {
  const volumePercent = Math.round(bgmVolume * 100);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-[var(--text-primary)]">
          <span>背景音量</span>
          <span className="text-[var(--text-secondary)]">{volumePercent}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={volumePercent}
          onValueChange={(value) => onBgmVolumeChange(value / 100)}
          disabled={!isSoundEnabled}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">总开关</div>
          <div className="text-xs text-[var(--text-muted)]">关闭后将静音所有音效</div>
        </div>
        <Switch checked={isSoundEnabled} onCheckedChange={onSoundEnabledChange} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">角色配音</div>
          <div className="text-xs text-[var(--text-muted)]">控制 AI 角色语音播放</div>
        </div>
        <Switch
          checked={isAiVoiceEnabled}
          onCheckedChange={onAiVoiceEnabledChange}
          disabled={!isSoundEnabled}
        />
      </div>
    </div>
  );
}

function ApiSettingsSection() {
  const [config, setConfig] = useState<ApiConfig>(() => getApiConfig());
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(getApiConfig());
  }, []);

  const handleSave = () => {
    saveApiConfig(config);
    setSaved(true);
    toast.success("配置已保存", { description: "刷新页面后生效" });
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = (field: keyof ApiConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleProviderChange = (providerId: string) => {
    const provider = API_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setConfig(prev => ({
        ...prev,
        llmProvider: providerId,
        llmBaseUrl: provider.baseUrl || prev.llmBaseUrl,
        llmModel: provider.defaultModel || prev.llmModel,
      }));
    }
  };

  const currentProvider = API_PROVIDERS.find(p => p.id === config.llmProvider) || API_PROVIDERS[0];

  return (
    <div className="space-y-4">
      {/* 没有 API Key 提示 */}
      {!config.llmApiKey && (
        <div className="rounded-lg bg-amber-500/10 border-2 border-amber-500/30 p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-amber-600">⚠️ 请先配置 API Key</div>
            <div className="text-xs text-amber-600/80">点击一键申请，复制 Key 填入下方即可</div>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => window.open(currentProvider.applyUrl || 'https://weapis.com', '_blank')}
            className="bg-amber-500 hover:bg-amber-600"
          >
            一键申请
          </Button>
        </div>
      )}

      {/* LLM API */}
      <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-3">
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">接口配置</div>
          <div className="text-xs text-[var(--text-muted)]">支持 OpenAI 兼容接口（DeepSeek、Azure 等）</div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1 block">API 服务商</label>
            <select
              value={config.llmProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            >
              {API_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {config.llmProvider === 'custom' && (
            <input
              type="url"
              value={config.llmBaseUrl}
              onChange={(e) => handleChange('llmBaseUrl', e.target.value)}
              placeholder="API Base URL"
              className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          )}

          <div className="relative">
            <input
              type={showLlmKey ? 'text' : 'password'}
              value={config.llmApiKey}
              onChange={(e) => handleChange('llmApiKey', e.target.value)}
              placeholder="API Key"
              className="w-full px-3 py-2 pr-10 text-sm bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="button"
              onClick={() => setShowLlmKey(!showLlmKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {showLlmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <input
            type="text"
            value={config.llmModel}
            onChange={(e) => handleChange('llmModel', e.target.value)}
            placeholder={`模型名称 (${currentProvider.defaultModel || 'deepseek-v3'})`}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* TTS API (MiniMax) */}
      <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">语音合成 (TTS)</div>
            <div className="text-xs text-[var(--text-muted)]">MiniMax 语音，让角色"说话"</div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={config.ttsEnabled}
              onCheckedChange={(v) => handleChange('ttsEnabled', v)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open('https://platform.minimaxi.com/', '_blank')}
              className="gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              申请
            </Button>
          </div>
        </div>

        {config.ttsEnabled && (
          <div className="space-y-2">
            <div className="relative">
              <input
                type={showTtsKey ? 'text' : 'password'}
                value={config.ttsApiKey}
                onChange={(e) => handleChange('ttsApiKey', e.target.value)}
                placeholder="MiniMax API Key"
                className="w-full px-3 py-2 pr-10 text-sm bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowTtsKey(!showTtsKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {showTtsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type="text"
              value={config.ttsGroupId}
              onChange={(e) => handleChange('ttsGroupId', e.target.value)}
              placeholder="MiniMax Group ID"
              className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        )}
      </div>

      <Button type="button" variant="default" onClick={handleSave} className="w-full">
        {saved ? "✓ 已保存" : "保存 API 配置"}
      </Button>
    </div>
  );
}

export function SettingsModal({
  open,
  onOpenChange,
  bgmVolume,
  isSoundEnabled,
  isAiVoiceEnabled,
  gameState,
  onBgmVolumeChange,
  onSoundEnabledChange,
  onAiVoiceEnabledChange,
}: SettingsModalProps) {
  const [view, setView] = useState<"settings" | "about" | "api">("settings");
  const [groupImgOk, setGroupImgOk] = useState<boolean | null>(null);

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

  const logJsonText = useMemo(() => {
    const exportedAt = new Date().toISOString();
    const env = typeof window === "undefined" ? undefined : {
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      language: window.navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const payload = {
      meta: {
        app: "wolfcha",
        appVersion,
        exportedAt,
      },
      env,
      settings: {
        bgmVolume,
        isSoundEnabled,
        isAiVoiceEnabled,
      },
      gameState,
    };

    return JSON.stringify(payload, null, 2);
  }, [appVersion, bgmVolume, gameState, isAiVoiceEnabled, isSoundEnabled]);

  const handleCopyLog = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(logJsonText);
      toast("已复制日志 JSON");
    } catch {
      toast("复制失败", { description: "当前环境不支持剪贴板或权限被拒绝" });
    }
  }, [logJsonText]);

  const handleDownloadLog = useCallback(() => {
    try {
      const blob = new Blob([logJsonText], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeGameId = (gameState.gameId || "").replace(/[^a-zA-Z0-9_-]/g, "");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `wolfcha-log-${safeGameId || "game"}-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("已导出日志文件");
    } catch {
      toast("导出失败");
    }
  }, [gameState.gameId, logJsonText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[var(--text-primary)]">
            {view === "about" ? "关于我们" : view === "api" ? "API 配置" : "设置"}
          </DialogTitle>
          <DialogDescription className="text-[var(--text-muted)]">
            {view === "about" ? "了解 Wolfcha" : view === "api" ? "配置 AI 模型和语音合成" : "调整偏好并导出日志"}
          </DialogDescription>
        </DialogHeader>

        {view === "api" ? (
          <div className="space-y-5">
            <ApiSettingsSection />
            <Button type="button" variant="outline" onClick={() => setView("settings")} className="w-full">
              返回设置
            </Button>
          </div>
        ) : view === "about" ? (
          <div className="space-y-5">
            <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-3">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Wolfcha"
                  className="h-12 w-12 shrink-0 rounded-xl border-2 border-[var(--border-color)] bg-[var(--bg-card)] object-cover"
                />
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text-primary)] font-medium leading-tight">Wolfcha（猹人杀）</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">版本号：v{appVersion}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
              <div className="text-sm font-medium text-[var(--text-primary)]">加入用户群</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">扫码入群，反馈问题与建议</div>
              <div className="mt-3 flex items-center justify-center">
                {groupImgOk !== false && (
                  <img
                    src="/group.png"
                    alt="Wolfcha 用户群"
                    className="w-full max-w-[260px] max-h-[34vh] sm:max-w-[300px] sm:max-h-[42vh] rounded-md border-2 border-[var(--border-color)] bg-white object-contain"
                    onLoad={() => setGroupImgOk(true)}
                    onError={() => setGroupImgOk(false)}
                  />
                )}
                {groupImgOk === false && (
                  <div className="text-xs text-[var(--text-muted)]">未找到群组图片（public/group.png）</div>
                )}
              </div>
            </div>

            <Button type="button" variant="outline" onClick={() => setView("settings")} className="w-full">
              返回设置
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">API 配置</div>
                <div className="text-xs text-[var(--text-muted)]">配置 AI 模型和语音合成</div>
              </div>
              <Button type="button" variant="default" onClick={() => setView("api")}>
                配置
              </Button>
            </div>

            <SoundSettingsSection
              bgmVolume={bgmVolume}
              isSoundEnabled={isSoundEnabled}
              isAiVoiceEnabled={isAiVoiceEnabled}
              onBgmVolumeChange={onBgmVolumeChange}
              onSoundEnabledChange={onSoundEnabledChange}
              onAiVoiceEnabledChange={onAiVoiceEnabledChange}
            />

            <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">日志</div>
                <div className="text-xs text-[var(--text-muted)]">遇到问题时，可导出 JSON 日志便于定位</div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => { void handleCopyLog(); }} className="flex-1">
                  复制 JSON
                </Button>
                <Button type="button" variant="default" onClick={handleDownloadLog} className="flex-1">
                  导出文件
                </Button>
              </div>
            </div>

            <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">关于我们</div>
                <div className="text-xs text-[var(--text-muted)]">Logo、版本号、入群二维码</div>
              </div>
              <Button type="button" variant="outline" onClick={() => setView("about")}>
                查看
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
