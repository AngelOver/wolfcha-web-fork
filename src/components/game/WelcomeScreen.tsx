"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FingerprintSimple, PawPrint, Sparkle, Wrench, GearSix, UserCircle, GithubLogo, DotsThreeOutlineVertical, Users, Key } from "@phosphor-icons/react";
import { WerewolfIcon } from "@/components/icons/FlatIcons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { DevPreset, DifficultyLevel, Role, StartGameOptions } from "@/types/game";
import { DevModeButton } from "@/components/DevTools";
import { GameSetupModal } from "@/components/game/GameSetupModal";
import { AuthModal } from "@/components/game/AuthModal";
import { SharePanel } from "@/components/game/SharePanel";
import { AccountModal } from "@/components/game/AccountModal";
import { ResetPasswordModal } from "@/components/game/ResetPasswordModal";
import { UserProfileModal } from "@/components/game/UserProfileModal";
import { useCredits } from "@/hooks/useCredits";
import { ApiConfigModal } from "@/components/game/ApiConfigModal";
import { AboutModal } from "@/components/game/AboutModal";
import { isApiConfigured } from "@/lib/api-config";

function buildDefaultRoles(playerCount: number): Role[] {
  switch (playerCount) {
    case 8:
      return ["Werewolf", "Werewolf", "Werewolf", "Seer", "Witch", "Hunter", "Villager", "Villager"];
    case 9:
      return [
        "Werewolf",
        "Werewolf",
        "Werewolf",
        "Seer",
        "Witch",
        "Hunter",
        "Villager",
        "Villager",
        "Villager",
      ];
    case 11:
      return [
        "Werewolf",
        "Werewolf",
        "Werewolf",
        "Werewolf",
        "Seer",
        "Witch",
        "Hunter",
        "Guard",
        "Villager",
        "Villager",
        "Villager",
      ];
    case 12:
      return [
        "Werewolf",
        "Werewolf",
        "Werewolf",
        "Werewolf",
        "Seer",
        "Witch",
        "Hunter",
        "Guard",
        "Villager",
        "Villager",
        "Villager",
        "Villager",
      ];
    case 10:
    default:
      return [
        "Werewolf",
        "Werewolf",
        "Werewolf",
        "Seer",
        "Witch",
        "Hunter",
        "Guard",
        "Villager",
        "Villager",
        "Villager",
      ];
  }
}

function getRoleCountConfig(playerCount: number) {
  const wolfCount = playerCount >= 11 ? 4 : 3;
  const guardCount = playerCount >= 10 ? 1 : 0;
  const seerCount = 1;
  const witchCount = 1;
  const hunterCount = 1;
  const godCount = seerCount + witchCount + hunterCount + guardCount;
  const villagerCount = Math.max(0, playerCount - wolfCount - godCount);
  return {
    wolfCount,
    guardCount,
    seerCount,
    witchCount,
    hunterCount,
    villagerCount,
  };
}

interface WelcomeScreenProps {
  humanName: string;
  setHumanName: (name: string) => void;
  onStart: (options?: StartGameOptions) => void | Promise<void>;
  onAbort?: () => void;
  isLoading: boolean;
  isGenshinMode: boolean;
  onGenshinModeChange: (value: boolean) => void;
  bgmVolume: number;
  isSoundEnabled: boolean;
  isAiVoiceEnabled: boolean;
  onBgmVolumeChange: (value: number) => void;
  onSoundEnabledChange: (value: boolean) => void;
  onAiVoiceEnabledChange: (value: boolean) => void;
}

export function WelcomeScreen({
  humanName,
  setHumanName,
  onStart,
  onAbort,
  isLoading,
  isGenshinMode,
  onGenshinModeChange,
  bgmVolume,
  isSoundEnabled,
  isAiVoiceEnabled,
  onBgmVolumeChange,
  onSoundEnabledChange,
  onAiVoiceEnabledChange,
}: WelcomeScreenProps) {
  const {
    user,
    credits,
    referralCode,
    totalReferrals,
    loading: creditsLoading,
    signOut,
    isPasswordRecovery,
    clearPasswordRecovery,
  } = useCredits();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const sealButtonRef = useRef<HTMLButtonElement | null>(null);
  const isStartingRef = useRef(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [groupImgOk, setGroupImgOk] = useState<boolean | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isApiConfigOpen, setIsApiConfigOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("normal");
  const [playerCount, setPlayerCount] = useState(10);

  // 调试面板状态
  const [isDevModeEnabled, setIsDevModeEnabled] = useState(false);
  const [isDevConsoleOpen, setIsDevConsoleOpen] = useState(false);
  const [devTab, setDevTab] = useState<"preset" | "roles">("preset");
  const [devPreset, setDevPreset] = useState<DevPreset | "">("");
  const showDevTools =
    process.env.NODE_ENV !== "production" && (process.env.NEXT_PUBLIC_SHOW_DEVTOOLS ?? "true") === "true";

  const roleOptions: Role[] = ["Villager", "Werewolf", "Seer", "Witch", "Hunter", "Guard"];
  const roleLabels: Record<Role, string> = {
    Villager: "村民",
    Werewolf: "狼人",
    Seer: "预言家",
    Witch: "女巫",
    Hunter: "猎人",
    Guard: "守卫",
  };

  const [fixedRoles, setFixedRoles] = useState<(Role | "")[]>(() => buildDefaultRoles(10));

  useEffect(() => {
    setFixedRoles(buildDefaultRoles(playerCount));
  }, [playerCount]);


  const roleConfigValid = useMemo(() => {
    if (fixedRoles.length !== playerCount) return false;
    if (fixedRoles.some((r) => !r)) return false;

    const counts: Record<Role, number> = {
      Villager: 0,
      Werewolf: 0,
      Seer: 0,
      Witch: 0,
      Hunter: 0,
      Guard: 0,
    };
    for (const r of fixedRoles) {
      counts[r as Role] += 1;
    }

    const expected = getRoleCountConfig(playerCount);
    return (
      counts.Werewolf === expected.wolfCount &&
      counts.Seer === expected.seerCount &&
      counts.Witch === expected.witchCount &&
      counts.Hunter === expected.hunterCount &&
      counts.Guard === expected.guardCount &&
      counts.Villager === expected.villagerCount
    );
  }, [fixedRoles, playerCount]);

  const roleConfigHint = useMemo(() => {
    const expected = getRoleCountConfig(playerCount);
    const godLabel = expected.guardCount > 0 ? "预女猎守" : "预女猎";
    return `需满足：${expected.wolfCount}狼 ${godLabel} ${expected.villagerCount}民`;
  }, [playerCount]);

  const canConfirm = useMemo(() => {
    return !!humanName.trim() && !isLoading && !isTransitioning && !creditsLoading;
  }, [humanName, isLoading, isTransitioning, creditsLoading]);

  const difficultyLabel = useMemo(() => {
    const labels: Record<DifficultyLevel, string> = {
      easy: "新手局",
      normal: "标准局",
      hard: "高阶局",
    };
    return labels[difficulty];
  }, [difficulty]);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;

    if (typeof window === "undefined") return;
    if ("ontouchstart" in window) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rafId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const update = () => {
      rafId = null;
      const xAxis = (window.innerWidth / 2 - lastX) / 60;
      const yAxis = (window.innerHeight / 2 - lastY) / 60;
      paper.style.setProperty("--wc-tilt-x", `${xAxis}`);
      paper.style.setProperty("--wc-tilt-y", `${yAxis}`);
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(update);
    };

    const onLeave = () => {
      paper.style.setProperty("--wc-tilt-x", "0");
      paper.style.setProperty("--wc-tilt-y", "0");
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const createParticles = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 18; i += 1) {
      const particle = document.createElement("div");
      particle.className = "wc-particle";
      document.body.appendChild(particle);

      const size = Math.random() * 7 + 2;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;

      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 90 + 40;
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity - 90;

      particle.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 },
        ],
        {
          duration: 900 + Math.random() * 450,
          easing: "cubic-bezier(0, .9, .57, 1)",
          fill: "forwards",
        }
      );

      window.setTimeout(() => particle.remove(), 1600);
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    if (isStartingRef.current) return;

    // 检查 API Key 配置
    if (!isApiConfigured()) {
      setIsApiConfigOpen(true);
      toast("请先配置 API Key");
      return;
    }

    // [已禁用] 登录检查
    // if (!user) {
    //   setIsAuthOpen(true);
    //   toast("请先登录或注册");
    //   return;
    // }

    // [已禁用] 额度检查
    // if (credits !== null && credits <= 0) {
    //   setIsShareOpen(true);
    //   toast("额度不足", { description: "分享邀请可获得更多额度。" });
    //   return;
    // }

    isStartingRef.current = true;

    const seal = sealButtonRef.current;
    if (seal) createParticles(seal);

    setIsTransitioning(true);

    window.setTimeout(() => {
      // 传递开发模式配置
      const roles = devTab === "roles" && roleConfigValid ? (fixedRoles as Role[]) : undefined;
      const preset = devTab === "preset" && devPreset ? (devPreset as DevPreset) : undefined;
      void onStart({ fixedRoles: roles, devPreset: preset, difficulty, playerCount });
      isStartingRef.current = false;
    }, 800);
  };

  return (
    <>
    <div className="wc-contract-screen selection:bg-[var(--color-accent)] selection:text-white">
      <div className="wc-contract-fog" aria-hidden="true" />
      <div className="wc-contract-vignette" aria-hidden="true" />

      <GameSetupModal
        open={isSetupOpen}
        onOpenChange={setIsSetupOpen}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        playerCount={playerCount}
        onPlayerCountChange={setPlayerCount}
        isGenshinMode={isGenshinMode}
        onGenshinModeChange={onGenshinModeChange}
        bgmVolume={bgmVolume}
        isSoundEnabled={isSoundEnabled}
        isAiVoiceEnabled={isAiVoiceEnabled}
        onBgmVolumeChange={onBgmVolumeChange}
        onSoundEnabledChange={onSoundEnabledChange}
        onAiVoiceEnabledChange={onAiVoiceEnabledChange}
      />
      {/* [已禁用] 登录弹窗 */}
      {/* <AuthModal open={isAuthOpen} onOpenChange={setIsAuthOpen} /> */}
      <AccountModal open={isAccountOpen} onOpenChange={setIsAccountOpen} />
      <UserProfileModal
        open={isUserProfileOpen}
        onOpenChange={setIsUserProfileOpen}
        email={user?.email}
        credits={credits ?? undefined}
        referralCode={referralCode}
        totalReferrals={totalReferrals}
        onChangePassword={() => setIsAccountOpen(true)}
        onShareInvite={() => setIsShareOpen(true)}
        onSignOut={signOut}
      />
      <ResetPasswordModal 
        open={isPasswordRecovery} 
        onOpenChange={(open) => !open && clearPasswordRecovery()}
        onSuccess={clearPasswordRecovery}
      />
      <SharePanel
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        referralCode={referralCode}
        totalReferrals={totalReferrals}
      />

      <ApiConfigModal open={isApiConfigOpen} onOpenChange={setIsApiConfigOpen} />
      <AboutModal open={isAboutOpen} onOpenChange={setIsAboutOpen} />

      <Dialog open={isGroupOpen} onOpenChange={setIsGroupOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} weight="duotone" />
              加入游戏群
            </DialogTitle>
            <DialogDescription>扫码入群，反馈问题与建议。</DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex items-center justify-center">
            {groupImgOk !== false && (
              <img
                src="/group.png"
                alt="Wolfcha 用户群"
                className="w-full max-w-[280px] max-h-[50vh] rounded-md border-2 border-[var(--border-color)] bg-white object-contain"
                onLoad={() => setGroupImgOk(true)}
                onError={() => setGroupImgOk(false)}
              />
            )}
            {groupImgOk === false && (
              <div className="text-xs text-[var(--text-muted)]">未找到群组图片（public/group.png）</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>快捷操作</DialogTitle>
            <DialogDescription>在这里快速进入设置与账号信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSetupOpen(true);
              }}
            >
              <GearSix size={16} />
              设置
            </Button>
            {user ? (
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsUserProfileOpen(true);
                }}
              >
                <UserCircle size={16} />
                账号信息
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsAboutOpen(true);
              }}
            >
              关于我们
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="wc-welcome-actions absolute top-5 right-5 z-20 flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2">
          {/* [已移除] GitHub 链接
          <a
            href="https://github.com/oil-oil/wolfcha"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-md border-2 border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all group"
            title="View on GitHub"
          >
            <GithubLogo size={15} className="group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline">GitHub</span>
          </a>
          */}
          <Button
            type="button"
            variant="default"
            onClick={() => setIsApiConfigOpen(true)}
            className="h-8 text-xs gap-2"
          >
            <Key size={16} />
            API 配置
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsGroupOpen(true)}
            className="h-8 text-xs gap-2"
          >
            <Users size={16} />
            加入游戏群
          </Button>

          {user ? (
            <button
              type="button"
              onClick={() => setIsUserProfileOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-md border-2 border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title="查看账号信息"
            >
              <UserCircle size={16} />
              <span className="truncate max-w-[160px]">{user.email ?? "已登录"}</span>
              <span className="opacity-70">剩余 {creditsLoading ? "..." : (credits ?? 0)} 局</span>
            </button>
          ) : null
          /* [已禁用] 登录按钮
          : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAuthOpen(true)}
              className="h-8 text-xs gap-2"
            >
              <UserCircle size={16} />
              登录/注册
            </Button>
          )
          */}

          {user && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUserProfileOpen(true)}
              className="h-8 text-xs gap-2 md:hidden"
            >
              <UserCircle size={16} />
              账号信息
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSetupOpen(true)}
            className="h-8 text-xs gap-2"
          >
            <GearSix size={16} />
            设置
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAboutOpen(true)}
            className="h-8 text-xs"
          >
            关于
          </Button>
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsGroupOpen(true)}
            className="h-8 text-xs gap-2"
          >
            <Users size={16} />
            入群
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsMobileMenuOpen(true)}
            className="h-8 w-8 px-0"
            aria-label="更多操作"
          >
            <DotsThreeOutlineVertical size={18} />
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.99, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[460px] px-6"
      >
        <div ref={paperRef} className="wc-contract-paper">
          <div className="wc-contract-borders" aria-hidden="true" />

          <div className="mt-2 text-center">
            <div className="mx-auto mb-4 h-12 w-12 items-center justify-center text-[var(--color-wolf)] opacity-90 hidden sm:flex">
              <PawPrint weight="fill" size={42} />
            </div>
            <div className="wc-contract-title">WOLFCHA</div>
            <div className="wc-contract-subtitle">The Shadow Game</div>
          </div>

          <div className="mt-7 text-center wc-contract-body">
            <div className="wc-contract-oath">
              我自愿加入这场关于谎言与真相的游戏。
              <br />
              当夜幕降临，我将隐藏我的身份；
              <br />
              当黎明升起，我将审判罪恶。
            </div>

            <div className="mt-8">
              <div className="wc-contract-label">签署你的名字</div>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={humanName}
                  onChange={(e) => setHumanName(e.target.value)}
                  placeholder="Signature Here..."
                  className="wc-signature-input"
                  autoComplete="off"
                  autoFocus
                  disabled={isLoading || isTransitioning}
                />
                <AnimatePresence>
                  {!!humanName.trim() && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="wc-signature-ok"
                    >
                      <Sparkle weight="fill" size={18} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="wc-seal-hint">
              {canConfirm ? "按下印章以生效" : "签署名字后才可生效"}
            </div>
            <button
              ref={sealButtonRef}
              type="button"
              className="wc-wax-seal"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              <FingerprintSimple weight="fill" size={44} className="wc-wax-seal-icon" />
            </button>
          </div>

          <div className="wc-corner-mark" aria-hidden="true">
            <WerewolfIcon size={30} className="text-[var(--color-wolf)] opacity-30" />
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            className="wc-transition-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <motion.div
              className="wc-transition-text"
              initial={{ opacity: 0, y: 10, scale: 1.05, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
            >
              <div className="wc-transition-title">游戏开始</div>
              <div className="wc-transition-subtitle">The Game Begins</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部版权信息 */}
      <div className="fixed bottom-3 left-0 right-0 z-50 text-center pointer-events-none">
        <button
          type="button"
          onClick={() => setIsAboutOpen(true)}
          className="pointer-events-auto text-[10px] text-[var(--text-secondary)] opacity-70 hover:opacity-100 transition-opacity px-2 py-1"
        >
          MIT License | 基于 oil-oil/wolfcha 二开
        </button>
      </div>
    </div>

    {showDevTools && (
      <>
        <DevModeButton
          onClick={() => {
            setIsDevModeEnabled(true);
            setIsDevConsoleOpen(true);
          }}
        />

        <AnimatePresence>
          {isDevConsoleOpen && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="wc-dev-console fixed right-0 top-0 bottom-0 w-[400px] z-[120] bg-gray-900/95 backdrop-blur-md border-l border-gray-700 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <Wrench size={20} className="text-yellow-400" />
                  <span className="font-bold text-white">开发者模式</span>
                </div>
                <button
                  onClick={() => setIsDevConsoleOpen(false)}
                  className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  type="button"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>

          <div className="flex border-b border-gray-700">
            <button
              type="button"
              onClick={() => setDevTab("preset")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                devTab === "preset"
                  ? "text-yellow-400 border-b-2 border-yellow-400 bg-gray-800/50"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/30"
              }`}
            >
              预设
            </button>
            <button
              type="button"
              onClick={() => setDevTab("roles")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                devTab === "roles"
                  ? "text-yellow-400 border-b-2 border-yellow-400 bg-gray-800/50"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/30"
              }`}
            >
              配置
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {devTab === "preset" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-300">预设场景测试</div>
                  <button
                    type="button"
                    onClick={() => setDevPreset("")}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    清除
                  </button>
                </div>
                <select
                  value={devPreset}
                  onChange={(e) => setDevPreset(e.target.value as DevPreset | "")}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                >
                  <option value="">无</option>
                  <option value="MILK_POISON_TEST">毒奶测试</option>
                  <option value="LAST_WORDS_TEST">遗言测试</option>
                </select>
              </div>
            )}

            {devTab === "roles" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-300">{`身份配置（${playerCount}人局）`}</div>
                  <div className={`text-xs ${roleConfigValid ? "text-green-400" : "text-gray-400"}`}>
                    {roleConfigValid ? "配置完成" : roleConfigHint}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {fixedRoles.map((role, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-10 text-xs text-gray-400">{idx + 1}号</span>
                      <select
                        value={role}
                        onChange={(e) => {
                          const next = [...fixedRoles];
                          next[idx] = e.target.value as Role;
                          setFixedRoles(next);
                        }}
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-yellow-400"
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {roleLabels[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
    )}
    </>
  );
}
