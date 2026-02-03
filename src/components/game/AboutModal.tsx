"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GithubLogo } from "@phosphor-icons/react";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[var(--text-primary)]">
            关于 Wolfcha
          </DialogTitle>
          <DialogDescription className="text-[var(--text-muted)]">
            AI 驱动的狼人杀游戏
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* 项目定位 */}
          <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
            <div className="font-medium text-[var(--text-primary)] mb-2">项目定位</div>
            <ul className="space-y-1 text-[var(--text-muted)] text-xs">
              <li>• <strong>纯前端项目</strong> - 无需后端部署</li>
              <li>• <strong>AI 驱动</strong> - 支持多种大语言模型</li>
              <li>• <strong>简化配置</strong> - 填入 API Key 即可使用</li>
            </ul>
          </div>

          {/* 开源信息 */}
          <div className="rounded-lg border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
            <div className="font-medium text-[var(--text-primary)] mb-2">开源信息</div>
            <div className="space-y-2 text-xs text-[var(--text-muted)]">
              <div>
                <span className="text-[var(--text-secondary)]">原项目：</span>
                <a
                  href="https://github.com/oil-oil/wolfcha"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1"
                >
                  <GithubLogo size={12} />
                  oil-oil/wolfcha
                </a>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">二开项目：</span>
                <a
                  href="https://github.com/fsoceityC/wolfcha-local"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1"
                >
                  <GithubLogo size={12} />
                  fsoceityC/wolfcha-local
                </a>
              </div>
              <div className="text-[var(--text-muted)] italic">
                本项目基于上述项目再次二开
              </div>
            </div>
          </div>

          {/* 免责声明 */}
          <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-3">
            <div className="font-medium text-amber-600 mb-2">免责声明</div>
            <ul className="space-y-1 text-[var(--text-muted)] text-xs leading-relaxed">
              <li>• 本项目仅供技术研究与学习交流</li>
              <li>• 禁止用于任何违法或违反道德的场景</li>
              <li>• 生成内容不代表开发者立场</li>
              <li>• 使用者需对自身行为负全责</li>
              <li>• 未成年人应在监护下使用</li>
            </ul>
          </div>

          {/* 版权信息 */}
          <div className="text-center text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-color)]">
            <div>本项目采用 MIT 协议开源</div>
            <div className="mt-1 opacity-70">
              © 2025 Wolfcha Contributors
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
