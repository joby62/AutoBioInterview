const CHAT_STAGES = ["daily", "evolution", "experience", "difficulty", "impact", "wrapup"];
const TRACK_STAGES = ["consent_pending", "daily", "evolution", "experience", "difficulty", "impact", "wrapup", "review", "done"];

const STAGE_NAMES = {
    consent_pending: "同意访谈",
    daily: "日常场景",
    evolution: "变化节点",
    experience: "体验感受",
    difficulty: "阻碍与应对",
    impact: "影响与反思",
    wrapup: "收尾补充",
    review: "草稿审阅",
    done: "定稿完成",
    withdrawn: "已撤回"
};

const TRACK_LABELS = {
    consent_pending: "同意访谈",
    daily: "日常",
    evolution: "变化",
    experience: "体验",
    difficulty: "困难",
    impact: "影响",
    wrapup: "补充",
    review: "审阅",
    done: "完成"
};

const STAGE_HINTS = {
    consent_pending: "确认知情同意后才会进入正式访谈。",
    daily: "从最近一次学习片段讲起，越具体越好。",
    evolution: "说明学习方式为什么改变、何时改变。",
    experience: "把情绪放进具体事件，而不是抽象评价。",
    difficulty: "说清困难、应对策略和实际效果。",
    impact: "扩展到生活、工作和认同层面的影响。",
    wrapup: "补充遗漏信息，准备生成自传草稿。",
    review: "草稿可反复修改，直到你满意。",
    done: "访谈完成，仍可继续微调文字。"
};

const STAGE_THEME = {
    consent_pending: { start: "#22c55e", end: "#16a34a", tail: "#16a34a", rgb: "22,163,74" },
    daily: { start: "#1f6cff", end: "#0a84ff", tail: "#1b73e8", rgb: "10,132,255" },
    evolution: { start: "#8b5cf6", end: "#7c3aed", tail: "#7c3aed", rgb: "124,58,237" },
    experience: { start: "#f59e0b", end: "#ea580c", tail: "#ea580c", rgb: "234,88,12" },
    difficulty: { start: "#ef4444", end: "#dc2626", tail: "#dc2626", rgb: "220,38,38" },
    impact: { start: "#10b981", end: "#059669", tail: "#059669", rgb: "5,150,105" },
    wrapup: { start: "#06b6d4", end: "#0891b2", tail: "#0891b2", rgb: "8,145,178" },
    review: { start: "#f97316", end: "#ea580c", tail: "#ea580c", rgb: "234,88,12" },
    done: { start: "#22c55e", end: "#16a34a", tail: "#16a34a", rgb: "22,163,74" },
    withdrawn: { start: "#9aa5b5", end: "#7a8798", tail: "#7a8798", rgb: "122,135,152" }
};

const STAGE_GUIDE = {
    consent_pending: {
        title: "开始前先确认知情同意",
        desc: "点“我同意并开始”后就会进入正式访谈，且引导弹窗自动消失。",
        sparks: []
    },
    daily: {
        title: "从最近一次场景说起",
        desc: "描述平台、时间、内容、场景，尽量像回忆具体片段。",
        sparks: [
            "最近一次是昨晚11点，我在B站学了40分钟。",
            "我通常在通勤时刷内容，睡前再整理笔记。",
            "我周末会集中学习2小时，工作日更碎片化。",
            "我最常用的平台是____，主要学习____。"
        ]
    },
    evolution: {
        title: "讲清变化前后",
        desc: "找一个关键节点，说明学习方式为什么改变。",
        sparks: [
            "找工作那年，我从碎片化阅读转到系统课程。",
            "入职后我学习从考试导向变成问题导向。",
            "某次失败让我重置了学习方法。",
            "以前我主要____，现在我更重视____。"
        ]
    },
    experience: {
        title: "让情绪有场景",
        desc: "不要只写“焦虑/充实”，讲触发情绪的具体时刻。",
        sparks: [
            "那次连续打卡让我有成就感，但也很疲惫。",
            "直播自习提高了效率，但结束后会空落。",
            "我发现自己容易被“高效感”吸引。",
            "最难忘的一次是____，因为____。"
        ]
    },
    difficulty: {
        title: "困难 + 策略 + 结果",
        desc: "每个问题后面补一句你怎么应对，效果如何。",
        sparks: [
            "我先限定一个主题，避免全平台漫游。",
            "番茄钟前30分钟有效，后面仍会分心。",
            "每周复盘后，我的焦虑下降明显。",
            "我最大的困难是____，我试过____。"
        ]
    },
    impact: {
        title: "扩展到生活影响",
        desc: "除了学业/工作，也可以说关系、作息、认同变化。",
        sparks: [
            "学习效率提升了，但休息时间被压缩。",
            "我更愿意分享知识，也更怕落后。",
            "持续学习变成了我的自我要求。",
            "我最珍视的是____，最矛盾的是____。"
        ]
    },
    wrapup: {
        title: "最后补一条关键故事",
        desc: "检查遗漏内容，或补充匿名化需求。",
        sparks: [
            "还有一段经历我希望写进自传：",
            "请把我提到的单位和地点进一步匿名化。",
            "我没有更多补充，可以进入草稿阶段。",
            "我最想保留的一段反思是____。"
        ]
    },
    review: {
        title: "草稿审阅中",
        desc: "先读草稿，再给明确的修改指令。",
        sparks: []
    },
    done: {
        title: "已完成定稿",
        desc: "如果需要微调，仍可继续修改草稿。",
        sparks: []
    },
    withdrawn: {
        title: "访谈已撤回",
        desc: "当前会话已结束，可重新开启新访谈。",
        sparks: []
    }
};

const TOKEN_KEY = "interview_token";
const SPEED_PREF_KEY = "thinking_speed_mode";
const DEFAULT_MODELS = ["doubao-seed-2-0-mini-260215", "doubao-seed-2-0-lite-260215"];

function safeStorageRead(key, fallback = "") {
    try {
        return window.localStorage.getItem(key) || fallback;
    } catch {
        return fallback;
    }
}

function safeStorageWrite(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // noop
    }
}

function safeStorageRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // noop
    }
}

const state = {
    token: safeStorageRead(TOKEN_KEY, ""),
    stage: "consent_pending",
    isBusy: false,
    lastDraft: "",
    toastTimer: null,
    enterPrimedAt: 0,
    availableModels: [...DEFAULT_MODELS],
    modelOrch: "doubao-seed-2-0-mini-260215",
    modelWrite: "doubao-seed-2-0-mini-260215",
    defaultModel: "doubao-seed-2-0-mini-260215",
    fastModel: "doubao-seed-2-0-mini-260215",
    slowModel: "doubao-seed-2-0-lite-260215",
    speedMode: safeStorageRead(SPEED_PREF_KEY, "fast") === "slow" ? "slow" : "fast",
    introSeenByToken: {}
};

const els = {
    appShell: document.getElementById("appShell"),
    canvas: document.getElementById("celebrateCanvas"),
    stageBadge: document.getElementById("stageBadge"),
    tokenBadge: document.getElementById("tokenBadge"),
    statsBadge: document.getElementById("statsBadge"),
    speedFastBtn: document.getElementById("speedFastBtn"),
    speedSlowBtn: document.getElementById("speedSlowBtn"),
    speedHint: document.getElementById("speedHint"),
    newInterviewBtn: document.getElementById("newInterviewBtn"),
    withdrawBtn: document.getElementById("withdrawBtn"),
    messages: document.getElementById("messages"),
    wordCounter: document.getElementById("wordCounter"),
    statusLine: document.getElementById("statusLine"),
    userInput: document.getElementById("userInput"),
    skipBtn: document.getElementById("skipBtn"),
    altBtn: document.getElementById("altBtn"),
    finalizeBtn: document.getElementById("finalizeBtn"),
    reviewActions: document.getElementById("reviewActions"),
    viewDraftBtn: document.getElementById("viewDraftBtn"),
    reviseDraftTriggerBtn: document.getElementById("reviseDraftTriggerBtn"),
    approveFinalBtn: document.getElementById("approveFinalBtn"),
    sendBtn: document.getElementById("sendBtn"),
    progressFooter: document.getElementById("progressFooter"),
    progressPercent: document.getElementById("progressPercent"),
    progressEta: document.getElementById("progressEta"),
    progressFill: document.getElementById("progressFill"),
    progressTrack: document.getElementById("progressTrack"),
    progressBubble: document.getElementById("progressBubble"),
    progressMeaning: document.getElementById("progressMeaning"),
    progressStageHint: document.getElementById("progressStageHint"),
    guideTitle: document.getElementById("guideTitle"),
    guideDesc: document.getElementById("guideDesc"),
    quickChips: document.getElementById("quickChips"),
    shuffleSparkBtn: document.getElementById("shuffleSparkBtn"),
    onboardingOverlay: document.getElementById("onboardingOverlay"),
    overlayDynamicText: document.getElementById("overlayDynamicText"),
    overlayAgreeBtn: document.getElementById("overlayAgreeBtn"),
    overlayDeclineBtn: document.getElementById("overlayDeclineBtn"),
    introOverlay: document.getElementById("introOverlay"),
    introConfirmBtn: document.getElementById("introConfirmBtn"),
    altModal: document.getElementById("altModal"),
    altType: document.getElementById("altType"),
    altUrl: document.getElementById("altUrl"),
    altTranscript: document.getElementById("altTranscript"),
    altNote: document.getElementById("altNote"),
    altCancelBtn: document.getElementById("altCancelBtn"),
    altSubmitBtn: document.getElementById("altSubmitBtn"),
    draftModal: document.getElementById("draftModal"),
    draftContent: document.getElementById("draftContent"),
    reviseInstruction: document.getElementById("reviseInstruction"),
    draftCloseBtn: document.getElementById("draftCloseBtn"),
    reviseBtn: document.getElementById("reviseBtn"),
    approveBtn: document.getElementById("approveBtn"),
    toast: document.getElementById("toast")
};

const confetti = {
    particles: [],
    raf: null,
    ctx: null,
    width: 0,
    height: 0
};

function isOnboardingVisible() {
    return !state.token || state.stage === "consent_pending";
}

function introSeenKey(token) {
    return token ? `intro_seen_${token}` : "";
}

function hasSeenIntro() {
    if (!state.token) return false;
    if (state.introSeenByToken[state.token]) return true;
    return safeStorageRead(introSeenKey(state.token), "") === "1";
}

function shouldShowIntroOverlay() {
    if (!state.token) return false;
    if (state.stage === "consent_pending" || state.stage === "withdrawn") return false;
    return !hasSeenIntro();
}

function isIntroVisible() {
    return shouldShowIntroOverlay();
}

function showToast(message, type = "") {
    if (!message) return;
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`.trim();
    els.toast.classList.add("visible");

    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
        els.toast.classList.remove("visible");
    }, 2600);
}

function parseErrorDetail(detail) {
    if (!detail) return "请求失败";
    if (typeof detail === "string") return detail;
    if (detail.message && detail.missing_requirements) {
        return `${detail.message}\n- ${detail.missing_requirements.join("\n- ")}`;
    }
    try {
        return JSON.stringify(detail, null, 2);
    } catch {
        return "请求失败";
    }
}

async function api(path, options = {}) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(parseErrorDetail(data.detail || data));
    }
    return data;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function stageIndex(stage) {
    return TRACK_STAGES.indexOf(stage);
}

function stageTheme(stage) {
    return STAGE_THEME[stage] || STAGE_THEME.daily;
}

function roleLabel(role) {
    if (role === "user") return "受访者";
    if (role === "assistant") return "访谈助手";
    return "系统提示";
}

function ensureCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    confetti.width = window.innerWidth;
    confetti.height = window.innerHeight;
    els.canvas.width = Math.floor(confetti.width * dpr);
    els.canvas.height = Math.floor(confetti.height * dpr);
    els.canvas.style.width = `${confetti.width}px`;
    els.canvas.style.height = `${confetti.height}px`;
    confetti.ctx = els.canvas.getContext("2d");
    confetti.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawnConfetti(intensity = 1) {
    const colors = ["#0a84ff", "#34c759", "#ff9f0a", "#ff375f", "#5e5ce6"];
    const count = Math.floor(34 * intensity);
    const startX = confetti.width * 0.5;
    const startY = Math.max(90, confetti.height * 0.2);

    for (let i = 0; i < count; i++) {
        confetti.particles.push({
            x: startX,
            y: startY,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * -8 - 2,
            g: 0.19 + Math.random() * 0.08,
            life: 62 + Math.random() * 26,
            size: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.3
        });
    }

    if (!confetti.raf) {
        confetti.raf = requestAnimationFrame(runConfetti);
    }
}

function runConfetti() {
    const ctx = confetti.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, confetti.width, confetti.height);
    confetti.particles = confetti.particles.filter((p) => p.life > 0);

    for (const p of confetti.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g;
        p.rot += p.vr;
        p.life -= 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size * 0.7);
        ctx.restore();
    }

    if (confetti.particles.length) {
        confetti.raf = requestAnimationFrame(runConfetti);
    } else {
        ctx.clearRect(0, 0, confetti.width, confetti.height);
        cancelAnimationFrame(confetti.raf);
        confetti.raf = null;
    }
}

function autosizeTextarea() {
    const el = els.userInput;
    el.style.height = "auto";
    el.style.height = `${Math.max(120, Math.min(el.scrollHeight, 240))}px`;
}

function updateWordCounter() {
    const count = els.userInput.value.trim().length;
    els.wordCounter.textContent = `${count} 字`;
}

function setStatus(text) {
    els.statusLine.textContent = text || "";
}

function renderProgressTrack() {
    const active = state.stage;
    const activeIndex = stageIndex(active);
    const total = Math.max(1, TRACK_STAGES.length - 1);
    const items = TRACK_STAGES.map((s, idx) => {
        let cls = "track-item";
        if (s === active) cls += " active";
        if (activeIndex >= 0 && idx < activeIndex) cls += " done";
        const hint = STAGE_HINTS[s] || "";
        const left = `${(idx / total) * 100}%`;
        return `<span class="${cls}" data-stage="${s}" data-label="${TRACK_LABELS[s] || STAGE_NAMES[s] || s}" style="left:${left}" title="${hint.replace(/"/g, "&quot;")}"></span>`;
    }).join("");

    els.progressTrack.innerHTML = items;
}

function renderProgressSummary() {
    const idx = Math.max(0, stageIndex(state.stage));
    const total = Math.max(1, TRACK_STAGES.length - 1);
    const ratio = idx / total;
    const pct = Math.round(ratio * 100);
    const theme = stageTheme(state.stage);

    els.progressPercent.textContent = `${pct}%`;
    els.progressFill.style.width = `${pct}%`;

    if (els.progressFooter) {
        els.progressFooter.style.setProperty("--progress-color-start", theme.start);
        els.progressFooter.style.setProperty("--progress-color-end", theme.end);
        els.progressFooter.style.setProperty("--progress-color-tail", theme.tail);
        els.progressFooter.style.setProperty("--progress-color-rgb", theme.rgb);
    }

    const remainingSteps = Math.max(0, total - idx);
    const eta = Math.max(0, remainingSteps * 5);
    els.progressEta.textContent = `${eta} min`;

    const stageName = STAGE_NAMES[state.stage] || state.stage;
    const stageHint = STAGE_HINTS[state.stage] || "按提示继续回答，系统会自动推进。";
    const bubbleLabel = TRACK_LABELS[state.stage] || stageName;
    const bubblePct = Math.min(94, Math.max(6, pct));
    els.progressBubble.textContent = bubbleLabel;
    els.progressBubble.style.left = `${bubblePct}%`;

    els.progressMeaning.textContent = "进度说明：圆点代表各步骤，彩色进度条显示整体推进。";
    els.progressStageHint.textContent = `当前步骤：${stageName}。${stageHint}`;
}

function renderHeaderMeta() {
    els.stageBadge.textContent = STAGE_NAMES[state.stage] || state.stage;
    els.stageBadge.dataset.stage = state.stage;
    els.tokenBadge.textContent = state.token ? `会话 ${state.token.slice(0, 8)}` : "未开始";
}

function renderGuide() {
    const guide = STAGE_GUIDE[state.stage] || STAGE_GUIDE.consent_pending;
    els.guideTitle.textContent = guide.title;
    els.guideDesc.textContent = guide.desc;
    renderSparkChips(guide.sparks || []);
}

function renderSparkChips(sparks) {
    if (!CHAT_STAGES.includes(state.stage) || sparks.length === 0) {
        els.quickChips.innerHTML = "";
        els.shuffleSparkBtn.disabled = true;
        return;
    }

    const sample = shuffle(sparks).slice(0, 4);
    els.shuffleSparkBtn.disabled = state.isBusy;
    els.quickChips.innerHTML = sample
        .map((spark) => `<button class="spark-chip" type="button" data-chip="${spark.replace(/"/g, "&quot;")}">${spark}</button>`)
        .join("");
}

function shuffleSparks() {
    const guide = STAGE_GUIDE[state.stage] || { sparks: [] };
    if (!guide.sparks || guide.sparks.length === 0) return;
    renderSparkChips(guide.sparks);
}

function syncOnboardingOverlay() {
    const visible = isOnboardingVisible();
    document.body.classList.toggle("onboarding-active", visible);
    els.onboardingOverlay.classList.toggle("visible", visible);

    if (!visible) return;

    if (!state.token) {
        els.overlayDynamicText.textContent = "还未创建会话。点击“我同意并开始”会自动创建会话并进入访谈。";
    } else if (state.stage === "consent_pending") {
        els.overlayDynamicText.textContent = "会话已创建，下一步确认同意即可进入正式访谈。";
    } else {
        els.overlayDynamicText.textContent = "准备进入访谈。";
    }
}

function syncIntroOverlay() {
    const visible = shouldShowIntroOverlay();
    document.body.classList.toggle("intro-active", visible);
    els.introOverlay.classList.toggle("visible", visible);
}

function confirmIntroAndClose() {
    if (!state.token) return;
    state.introSeenByToken[state.token] = true;
    safeStorageWrite(introSeenKey(state.token), "1");
    syncUi();
}

function setBusy(flag) {
    state.isBusy = flag;
    const overlayVisible = isOnboardingVisible() || isIntroVisible();
    const chatEnabled = CHAT_STAGES.includes(state.stage) && !overlayVisible;
    const reviewEnabled = (state.stage === "review" || state.stage === "done") && !overlayVisible;

    els.userInput.disabled = flag || !chatEnabled;
    els.sendBtn.disabled = flag || !chatEnabled;
    els.skipBtn.disabled = flag || !chatEnabled;
    els.altBtn.disabled = flag || !chatEnabled;
    els.finalizeBtn.disabled = flag || !(state.stage === "wrapup" || state.stage === "review") || overlayVisible;
    els.newInterviewBtn.disabled = flag;
    els.withdrawBtn.disabled = flag || !state.token || state.stage === "withdrawn";

    els.overlayAgreeBtn.disabled = flag;
    els.overlayDeclineBtn.disabled = flag;
    els.introConfirmBtn.disabled = flag;

    els.altSubmitBtn.disabled = flag;
    els.reviseBtn.disabled = flag || !reviewEnabled;
    els.approveBtn.disabled = flag || !reviewEnabled;
    els.shuffleSparkBtn.disabled = flag || !chatEnabled;

    if (flag) {
        els.userInput.placeholder = "系统处理中...";
        if (els.speedHint) {
            els.speedHint.textContent = "助手思考中，可切换快/慢（下一轮生效）";
        }
    } else {
        els.userInput.placeholder = "输入你的回答。双击 Enter 发送；Shift+Enter 换行；Cmd/Ctrl+Enter 立即发送。";
        renderSpeedControl();
    }
}

function syncUi() {
    const showReview = state.stage === "review" || state.stage === "done";
    els.reviewActions.classList.toggle("visible", showReview);

    renderHeaderMeta();
    renderProgressTrack();
    renderProgressSummary();
    renderGuide();
    syncOnboardingOverlay();
    syncIntroOverlay();
    setBusy(false);

    if (state.stage === "consent_pending") {
        setStatus("等待同意后开始访谈");
    } else if (state.stage === "review") {
        setStatus("草稿已生成，建议先通读再改稿");
    } else if (state.stage === "done") {
        setStatus("定稿已完成，仍可继续修改");
    } else if (state.stage === "withdrawn") {
        setStatus("访谈已撤回，可开启新访谈");
    }
}

function createMessageEl(role, content, animate = true) {
    const wrap = document.createElement("article");
    wrap.className = `message ${role}`;
    if (!animate) wrap.style.animation = "none";

    const roleEl = document.createElement("div");
    roleEl.className = "role";
    roleEl.textContent = roleLabel(role);

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = content;

    wrap.appendChild(roleEl);
    wrap.appendChild(bubble);
    return { wrap, bubble };
}

function appendMessage(role, content, options = {}) {
    const { animate = true, scroll = true } = options;
    const node = createMessageEl(role, content, animate);
    els.messages.appendChild(node.wrap);
    if (scroll) els.messages.scrollTop = els.messages.scrollHeight;
    return node;
}

function appendThinkingBubble(text = "正在思考") {
    const wrap = document.createElement("article");
    wrap.className = "message assistant";

    const roleEl = document.createElement("div");
    roleEl.className = "role";
    roleEl.textContent = "访谈助手";

    const bubble = document.createElement("div");
    bubble.className = "bubble typing";
    bubble.textContent = `${text} `;
    bubble.appendChild(document.createElement("span"));
    bubble.appendChild(document.createElement("span"));
    bubble.appendChild(document.createElement("span"));

    wrap.appendChild(roleEl);
    wrap.appendChild(bubble);
    els.messages.appendChild(wrap);
    els.messages.scrollTop = els.messages.scrollHeight;
    return wrap;
}

async function appendAssistantTypewriter(content) {
    const node = createMessageEl("assistant", "", true);
    els.messages.appendChild(node.wrap);
    els.messages.scrollTop = els.messages.scrollHeight;

    const speed = content.length > 160 ? 8 : 11;
    let out = "";
    for (const ch of content) {
        out += ch;
        node.bubble.textContent = out;
        els.messages.scrollTop = els.messages.scrollHeight;
        await sleep(speed);
    }
}

function detectStageAdvance(prev, next) {
    const p = stageIndex(prev);
    const n = stageIndex(next);
    return p >= 0 && n > p;
}

function applyExportStats(payload) {
    const userCount = (payload.messages || []).filter((m) => m.role === "user").length;
    const draftCount = (payload.artifacts || []).filter((a) => a.type === "draft").length;
    const userChars = (payload.messages || [])
        .filter((m) => m.role === "user")
        .reduce((acc, m) => acc + (m.content || "").length, 0);

    els.statsBadge.textContent = `回答 ${userCount} 条 · ${userChars} 字 · 草稿 ${draftCount} 版`;

    if (payload.readiness && payload.readiness.stages && payload.readiness.stages[state.stage]) {
        const info = payload.readiness.stages[state.stage];
        if (CHAT_STAGES.includes(state.stage) && Array.isArray(info.missing) && info.missing.length) {
            setStatus(`当前阶段建议补充：${info.missing.slice(0, 2).join("；")}`);
        }
    }
}

function openAltModal() {
    els.altModal.classList.add("visible");
}

function closeAltModal() {
    els.altModal.classList.remove("visible");
}

function openDraftModal() {
    els.draftModal.classList.add("visible");
    if (state.lastDraft) {
        els.draftContent.textContent = state.lastDraft;
    }
}

function closeDraftModal() {
    els.draftModal.classList.remove("visible");
}

function focusRevisionInput() {
    openDraftModal();
    setTimeout(() => {
        els.reviseInstruction.focus();
    }, 80);
}

async function loadModelConfig() {
    try {
        const data = await api("/model-config");
        state.availableModels = Array.isArray(data.available_models) && data.available_models.length
            ? data.available_models
            : [...DEFAULT_MODELS];
        state.defaultModel = data.default_model || state.availableModels[0];
        const speedModels = resolveSpeedModels(state.availableModels, state.defaultModel);
        state.fastModel = speedModels.fastModel;
        state.slowModel = speedModels.slowModel;

        const preferred = safeStorageRead(SPEED_PREF_KEY, "fast") === "slow" ? "slow" : "fast";
        state.speedMode = preferred === "slow" && state.fastModel !== state.slowModel ? "slow" : "fast";
        const targetModel = state.speedMode === "slow" ? state.slowModel : state.fastModel;

        state.modelOrch = data.orch_model || targetModel;
        state.modelWrite = data.write_model || state.modelOrch;

        if (state.modelOrch !== targetModel || state.modelWrite !== targetModel) {
            const ok = await updateModelConfig(targetModel, false);
            if (!ok) {
                state.speedMode = state.modelOrch === state.slowModel && state.slowModel !== state.fastModel ? "slow" : "fast";
            }
        }
    } catch {
        state.availableModels = [...DEFAULT_MODELS];
        state.defaultModel = DEFAULT_MODELS[0];
        const speedModels = resolveSpeedModels(state.availableModels, state.defaultModel);
        state.fastModel = speedModels.fastModel;
        state.slowModel = speedModels.slowModel;
        state.modelOrch = state.fastModel;
        state.modelWrite = state.fastModel;
        state.speedMode = "fast";
        safeStorageWrite(SPEED_PREF_KEY, "fast");
    }

    renderSpeedControl();
}

function resolveSpeedModels(models, defaultModel) {
    const pool = [...new Set((models || []).filter(Boolean))];
    const mini = pool.find((m) => /mini/i.test(m));
    const lite = pool.find((m) => /lite/i.test(m));

    let fastModel = mini || defaultModel || pool[0] || DEFAULT_MODELS[0];
    if (!pool.includes(fastModel)) pool.push(fastModel);
    let slowModel = lite || pool.find((m) => m !== fastModel) || fastModel;

    if (!slowModel) slowModel = fastModel;
    return { fastModel, slowModel };
}

function renderSpeedControl() {
    const isSlow = state.speedMode === "slow";
    const hasBothSpeeds = state.fastModel !== state.slowModel;

    els.speedFastBtn.classList.toggle("active", !isSlow);
    els.speedSlowBtn.classList.toggle("active", isSlow);
    els.speedFastBtn.setAttribute("aria-pressed", String(!isSlow));
    els.speedSlowBtn.setAttribute("aria-pressed", String(isSlow));
    els.speedSlowBtn.disabled = !hasBothSpeeds;

    if (!hasBothSpeeds) {
        els.speedHint.textContent = "当前仅配置一种速度";
        return;
    }

    if (state.isBusy) {
        els.speedHint.textContent = "助手思考中，可切换快/慢（下一轮生效）";
    } else {
        els.speedHint.textContent = `当前：${isSlow ? "慢速" : "快速"}思考`;
    }
}

async function updateModelConfig(model, notify = true) {
    if (!model) return;
    try {
        const data = await api("/model-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model })
        });
        state.modelOrch = data.orch_model;
        state.modelWrite = data.write_model;
        if (notify) {
            showToast(`已切换为${state.speedMode === "slow" ? "慢速" : "快速"}思考`, "success");
        }
        return true;
    } catch (err) {
        if (notify) {
            showToast(String(err.message || err), "error");
        }
        return false;
    }
}

async function switchSpeed(mode) {
    if (!["fast", "slow"].includes(mode)) return;
    if (mode === "slow" && state.fastModel === state.slowModel) {
        showToast("当前只配置了一种速度", "");
        return;
    }
    if (mode === state.speedMode) return;

    const prev = state.speedMode;
    state.speedMode = mode;
    renderSpeedControl();

    const targetModel = mode === "slow" ? state.slowModel : state.fastModel;
    const ok = await updateModelConfig(targetModel);
    if (!ok) {
        state.speedMode = prev;
        renderSpeedControl();
        return;
    }
    safeStorageWrite(SPEED_PREF_KEY, state.speedMode);
}

async function refreshState(fullRefresh = false) {
    if (!state.token) {
        state.stage = "consent_pending";
        els.messages.innerHTML = "";
        appendMessage("assistant", "欢迎参与。点击上层弹窗里的“我同意并开始”，将自动创建会话并进入访谈。", { animate: false });
        els.statsBadge.textContent = "暂无记录";
        state.lastDraft = "";
        els.draftContent.textContent = "尚未生成草稿。";
        syncUi();
        return;
    }

    try {
        const data = await api(`/export?token=${encodeURIComponent(state.token)}`);

        if (fullRefresh) {
            els.messages.innerHTML = "";
            (data.messages || []).forEach((m) => {
                appendMessage(m.role || "assistant", m.content || "", { animate: false, scroll: false });
            });
            els.messages.scrollTop = els.messages.scrollHeight;
        }

        state.stage = data.interview.stage || "consent_pending";
        applyExportStats(data);

        const latestDraft = (data.artifacts || []).find((a) => a.type === "draft");
        if (latestDraft && latestDraft.content) {
            state.lastDraft = latestDraft.content;
            els.draftContent.textContent = state.lastDraft;
        }

        syncUi();
    } catch (err) {
        safeStorageRemove(TOKEN_KEY);
        state.token = "";
        state.stage = "consent_pending";
        els.messages.innerHTML = "";
        appendMessage("system", "当前 token 不可用，已重置会话。", { animate: false });
        syncUi();
        showToast(String(err.message || err), "error");
    }
}

async function startNewInterview() {
    if (state.isBusy) return;
    if (state.token && !confirm("开启新访谈会替换当前 token，是否继续？")) return;

    setBusy(true);
    try {
        const data = await api("/interviews", { method: "POST" });
        state.token = data.token;
        state.stage = data.stage;
        safeStorageWrite(TOKEN_KEY, state.token);
        state.lastDraft = "";
        els.reviseInstruction.value = "";
        await refreshState(true);
        showToast("会话已创建，请在上层弹窗点击“我同意并开始”", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function overlayAgreeAndStart() {
    if (state.isBusy) return;

    setBusy(true);
    try {
        if (!state.token) {
            const created = await api("/interviews", { method: "POST" });
            state.token = created.token;
            state.stage = created.stage;
            safeStorageWrite(TOKEN_KEY, state.token);
        }

        if (state.stage === "consent_pending") {
            const res = await api("/consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: state.token, agreed: true })
            });
            const prev = state.stage;
            state.stage = res.stage || "daily";
            if (detectStageAdvance(prev, state.stage)) {
                spawnConfetti(0.9);
            }
        }

        await refreshState(true);
        showToast("已同意并开始访谈", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function overlayDecline() {
    if (state.isBusy) return;

    if (!state.token) {
        showToast("你可以直接关闭页面，或稍后再来。", "");
        return;
    }

    setBusy(true);
    try {
        if (state.stage === "consent_pending") {
            const res = await api("/consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: state.token, agreed: false })
            });
            state.stage = res.stage || "withdrawn";
        } else {
            const res = await api("/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: state.token, reason: "" })
            });
            state.stage = res.stage || "withdrawn";
        }

        await refreshState(true);
        showToast("已记录为不同意参与", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function sendMessage() {
    if (state.isBusy || !state.token || !CHAT_STAGES.includes(state.stage)) return;

    const content = els.userInput.value.trim();
    if (!content) {
        showToast("先输入内容再发送", "");
        return;
    }

    setBusy(true);
    els.userInput.value = "";
    autosizeTextarea();
    updateWordCounter();

    appendMessage("user", content);
    const typing = appendThinkingBubble();

    try {
        await api("/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, content })
        });

        const prevStage = state.stage;
        const data = await api(`/next?token=${encodeURIComponent(state.token)}`, { method: "POST" });
        typing.remove();

        const nextText = (data.questions || []).join("\n") || "我换个角度继续追问。";
        await appendAssistantTypewriter(nextText);
        if (data.rights_notice) appendMessage("system", data.rights_notice);

        state.stage = data.should_advance_stage ? data.suggested_next_stage : data.stage;
        if (detectStageAdvance(prevStage, state.stage)) {
            spawnConfetti(1);
            showToast(`进入${STAGE_NAMES[state.stage]}阶段`, "success");
        }

        if (Array.isArray(data.missing_requirements) && data.missing_requirements.length) {
            setStatus(`当前阶段建议补充：${data.missing_requirements.slice(0, 2).join("；")}`);
        } else if (data.stage_ready) {
            setStatus("当前阶段信息已达标，继续聊可推进下一阶段");
        }

        syncUi();
    } catch (err) {
        typing.remove();
        appendMessage("system", String(err.message || err));
    } finally {
        setBusy(false);
    }
}

async function skipQuestion() {
    if (state.isBusy || !state.token || !CHAT_STAGES.includes(state.stage)) return;

    setBusy(true);
    const typing = appendThinkingBubble("正在换个问法");

    try {
        const prevStage = state.stage;
        const data = await api("/skip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, reason: "" })
        });
        typing.remove();

        await appendAssistantTypewriter((data.questions || []).join("\n") || "没问题，我们继续。");
        if (data.rights_notice) appendMessage("system", data.rights_notice);

        state.stage = data.should_advance_stage ? data.suggested_next_stage : data.stage;
        if (detectStageAdvance(prevStage, state.stage)) {
            spawnConfetti(0.9);
        }

        syncUi();
    } catch (err) {
        typing.remove();
        appendMessage("system", String(err.message || err));
    } finally {
        setBusy(false);
    }
}

async function withdrawInterview() {
    if (state.isBusy || !state.token) return;
    if (!confirm("确认撤回当前访谈？撤回后会停止此会话。")) return;

    setBusy(true);
    try {
        const res = await api("/withdraw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, reason: "" })
        });
        state.stage = res.stage || "withdrawn";
        await refreshState(true);
        showToast("已撤回当前访谈", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function submitAlternative() {
    if (state.isBusy || !state.token) return;

    const submission_type = els.altType.value;
    const url = els.altUrl.value.trim();
    const transcript = els.altTranscript.value.trim();
    const note = els.altNote.value.trim();

    if (!url && !transcript) {
        showToast("请至少填写链接或转写文本", "error");
        return;
    }

    setBusy(true);
    try {
        await api("/alternative-submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, submission_type, url, transcript, note })
        });

        els.altUrl.value = "";
        els.altTranscript.value = "";
        els.altNote.value = "";
        closeAltModal();
        await refreshState(true);
        showToast("替代提交已记录", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function finalizeInterview(force = false) {
    if (state.isBusy || !state.token) return;
    if (!(state.stage === "wrapup" || state.stage === "review")) {
        showToast("当前阶段还不能生成草稿", "error");
        return;
    }

    setBusy(true);
    const oldText = els.finalizeBtn.textContent;
    els.finalizeBtn.textContent = "生成中...";

    try {
        const data = await api("/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, force })
        });

        state.stage = data.stage || "review";
        state.lastDraft = data.content || "";
        els.draftContent.textContent = state.lastDraft || "草稿为空。";
        openDraftModal();
        await refreshState();
        spawnConfetti(1.1);
        showToast("草稿已生成，可继续润色", "success");
    } catch (err) {
        const message = String(err.message || err);
        if (!force && message.includes("missing_requirements")) {
            if (confirm(`${message}\n\n是否忽略门禁继续生成？`)) {
                setBusy(false);
                els.finalizeBtn.textContent = oldText;
                return finalizeInterview(true);
            }
        }
        showToast(message, "error");
    } finally {
        els.finalizeBtn.textContent = oldText;
        setBusy(false);
    }
}

async function reviseDraft() {
    if (state.isBusy || !state.token) return;
    const instruction = els.reviseInstruction.value.trim();
    if (!instruction) {
        showToast("请先输入修改指令", "error");
        return;
    }

    setBusy(true);
    try {
        const data = await api("/revise-final", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, instruction })
        });
        state.stage = data.stage || "review";
        state.lastDraft = data.content || "";
        els.draftContent.textContent = state.lastDraft || "草稿为空。";
        await refreshState();
        showToast("草稿已更新", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function approveFinal() {
    if (state.isBusy || !state.token) return;
    if (!confirm("确认将当前草稿定稿吗？")) return;

    setBusy(true);
    try {
        await api("/approve-final", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token })
        });
        state.stage = "done";
        await refreshState();
        spawnConfetti(1.3);
        showToast("定稿完成", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

function handleInputKeydown(event) {
    if (event.key !== "Enter") return;

    if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        sendMessage();
        return;
    }

    if (event.shiftKey) {
        return;
    }

    event.preventDefault();
    const now = Date.now();
    if (state.enterPrimedAt && now - state.enterPrimedAt < 520) {
        state.enterPrimedAt = 0;
        sendMessage();
    } else {
        state.enterPrimedAt = now;
        showToast("再按一次 Enter 发送；Shift+Enter 换行", "");
        setTimeout(() => {
            if (Date.now() - state.enterPrimedAt >= 520) {
                state.enterPrimedAt = 0;
            }
        }, 560);
    }
}

function attachEvents() {
    els.newInterviewBtn.addEventListener("click", startNewInterview);
    els.withdrawBtn.addEventListener("click", withdrawInterview);

    els.speedFastBtn.addEventListener("click", () => {
        switchSpeed("fast");
    });
    els.speedSlowBtn.addEventListener("click", () => {
        switchSpeed("slow");
    });

    els.overlayAgreeBtn.addEventListener("click", overlayAgreeAndStart);
    els.overlayDeclineBtn.addEventListener("click", overlayDecline);
    els.introConfirmBtn.addEventListener("click", confirmIntroAndClose);

    els.sendBtn.addEventListener("click", sendMessage);
    els.skipBtn.addEventListener("click", skipQuestion);
    els.altBtn.addEventListener("click", openAltModal);
    els.finalizeBtn.addEventListener("click", () => finalizeInterview());

    els.viewDraftBtn.addEventListener("click", openDraftModal);
    els.reviseDraftTriggerBtn.addEventListener("click", focusRevisionInput);
    els.approveFinalBtn.addEventListener("click", approveFinal);

    els.shuffleSparkBtn.addEventListener("click", shuffleSparks);

    els.altCancelBtn.addEventListener("click", closeAltModal);
    els.altSubmitBtn.addEventListener("click", submitAlternative);

    els.draftCloseBtn.addEventListener("click", closeDraftModal);
    els.reviseBtn.addEventListener("click", reviseDraft);
    els.approveBtn.addEventListener("click", approveFinal);

    els.altModal.addEventListener("click", (event) => {
        if (event.target === els.altModal) closeAltModal();
    });
    els.draftModal.addEventListener("click", (event) => {
        if (event.target === els.draftModal) closeDraftModal();
    });

    els.userInput.addEventListener("keydown", handleInputKeydown);
    els.userInput.addEventListener("input", () => {
        autosizeTextarea();
        updateWordCounter();
    });

    document.addEventListener("click", (event) => {
        const chip = event.target.closest(".spark-chip");
        if (!chip || state.isBusy) return;
        const snippet = chip.dataset.chip || chip.textContent || "";
        const current = els.userInput.value.trim();
        els.userInput.value = current ? `${current}\n${snippet}` : snippet;
        autosizeTextarea();
        updateWordCounter();
        els.userInput.focus();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAltModal();
            closeDraftModal();
        }
    });

    window.addEventListener("resize", ensureCanvasSize);
}

async function bootstrap() {
    try {
        ensureCanvasSize();
        attachEvents();
        autosizeTextarea();
        updateWordCounter();

        await loadModelConfig();
        syncUi();
        await refreshState(true);
    } catch (err) {
        console.error("Bootstrap failed:", err);
        setStatus("页面初始化失败，请刷新重试");
        showToast(`页面初始化失败：${String(err.message || err)}`, "error");
    }
}

bootstrap();
