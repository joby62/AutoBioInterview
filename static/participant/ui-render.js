function parseIsoTimeMs(value) {
    if (!value) return null;
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
}

function updatePaceEstimate(payload) {
    const currentStage = payload?.interview?.stage || state.stage;
    const currentIdx = Math.max(0, stageIndex(currentStage));
    if (currentIdx <= 0) return;

    const userMsgs = (payload?.messages || [])
        .filter((m) => m.role === "user")
        .filter((m) => {
            const text = (m.content || "").trim();
            if (!text) return false;
            return !text.startsWith("【受访者选择跳过此问题】");
        });

    const userTimes = userMsgs
        .map((m) => parseIsoTimeMs(m.created_at))
        .filter((t) => t !== null)
        .sort((a, b) => a - b);

    let minutesPerStep = null;

    if (userTimes.length >= 2) {
        const gaps = [];
        for (let i = 1; i < userTimes.length; i++) {
            const gapMin = (userTimes[i] - userTimes[i - 1]) / 60000;
            // Ignore ultra-short bursts and long idle breaks.
            if (gapMin >= 0.2 && gapMin <= 30) gaps.push(gapMin);
        }
        if (gaps.length) {
            const avgGap = gaps.reduce((acc, v) => acc + v, 0) / gaps.length;
            const repliesPerStep = Math.max(1, Math.min(4, userMsgs.length / currentIdx));
            minutesPerStep = avgGap * repliesPerStep;
        }
    }

    if (!Number.isFinite(minutesPerStep)) {
        const consentMs = parseIsoTimeMs(payload?.interview?.consented_at);
        if (consentMs) {
            const elapsedMin = Math.max(0, (Date.now() - consentMs) / 60000);
            if (elapsedMin > 0) {
                minutesPerStep = elapsedMin / currentIdx;
            }
        }
    }

    if (!Number.isFinite(minutesPerStep)) return;

    minutesPerStep = Math.max(2, Math.min(20, minutesPerStep));
    state.estimatedStepMinutes = state.estimatedStepMinutes * 0.65 + minutesPerStep * 0.35;
}

function roleLabel(role) {
    if (role === "user") return "受访者";
    if (role === "assistant") return "访谈助手";
    return "系统提示";
}

function speedModeLabel(mode) {
    if (mode === "deep") return "深度";
    if (mode === "balanced") return "中庸";
    return "快速";
}

function modelBySpeedMode(mode) {
    if (mode === "deep") return state.deepModel;
    if (mode === "balanced") return state.balancedModel;
    return state.fastModel;
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

    els.progressPanel.style.setProperty("--progress-color-start", theme.start);
    els.progressPanel.style.setProperty("--progress-color-end", theme.end);
    els.progressPanel.style.setProperty("--progress-color-tail", theme.tail);
    els.progressPanel.style.setProperty("--progress-color-rgb", theme.rgb);

    const reqTotal = STAGE_REQUIREMENT_TOTAL[state.stage] ?? 1;
    const missingCount = Math.min(reqTotal, (state.stageMissing || []).length);
    const completion = stageCompletionRatio(state.stage, state.stageMissing, state.stageReady);
    let stageRemainingRatio = state.stageReady ? 0.12 : Math.max(0.2, missingCount / Math.max(1, reqTotal));
    if (!state.stageReady && missingCount === 0 && CHAT_STAGES.includes(state.stage)) {
        stageRemainingRatio = 0.35;
    }
    const stageCenter = clamp(state.estimatedStepMinutes * (0.42 + 0.95 * stageRemainingRatio), 1, 35);
    const stageLow = clamp(stageCenter * 0.7, 1, 50);
    const stageHigh = clamp(stageCenter * 1.35, stageLow + 1, 60);

    const afterCurrentSteps = Math.max(0, total - idx - 1);
    const futureCenter = afterCurrentSteps * state.estimatedStepMinutes;
    const overallLow = stageLow + futureCenter * 0.75;
    const overallHigh = stageHigh + futureCenter * 1.25;
    const overallRange = rangeText(overallLow, overallHigh);
    els.progressEta.textContent = overallRange;

    const stageName = STAGE_NAMES[state.stage] || state.stage;
    const stageHint = STAGE_HINTS[state.stage] || "按提示继续回答，系统会自动推进。";
    const bubbleLabel = TRACK_LABELS[state.stage] || stageName;
    const bubblePct = Math.min(94, Math.max(6, pct));
    els.progressBubble.textContent = bubbleLabel;
    els.progressBubble.style.left = `${bubblePct}%`;
    state.progressPct = pct;
    ensureFabTicker();
    updateFabTickerText();
    els.progressFab.style.setProperty("--fab-progress", `${pct}`);
    els.progressFab.style.setProperty("--fab-color", theme.end);

    els.progressStageHint.textContent = `当前步骤：${stageName}。${stageHint}`;

    if (state.stageReady) {
        els.progressStageEta.textContent = `本阶段预计还需 ${rangeText(1, Math.max(2, stageLow + 1))}，可收尾进入下一阶段。`;
    } else if (Array.isArray(state.stageMissing) && state.stageMissing.length) {
        const focus = state.stageMissing.slice(0, 2).join("；");
        els.progressStageEta.textContent = `本阶段预计还需 ${rangeText(stageLow, stageHigh)}。建议补充：${focus}。`;
    } else {
        const p = Math.round(completion * 100);
        els.progressStageEta.textContent = `本阶段预计还需 ${rangeText(stageLow, stageHigh)}（当前完成度约 ${p}%）。`;
    }

    placeProgressPanelNearFab();
}

function updateFabTickerText() {
    const stageLabel = TRACK_LABELS[state.stage] || STAGE_NAMES[state.stage] || "进度";
    const text = state.fabDisplayMode === "stage" ? stageLabel : `${Math.round(state.progressPct || 0)}%`;
    els.progressFabPct.textContent = text;
    els.progressFab.classList.toggle("show-stage", state.fabDisplayMode === "stage");
}

function ensureFabTicker() {
    if (state.fabDisplayTimer) return;
    state.fabDisplayTimer = setInterval(() => {
        state.fabDisplayMode = state.fabDisplayMode === "percent" ? "stage" : "percent";
        els.progressFab.classList.add("fab-switching");
        setTimeout(() => {
            els.progressFab.classList.remove("fab-switching");
            updateFabTickerText();
        }, 140);
    }, 2600);
}

function renderHeaderMeta() {
    els.stageBadge.textContent = STAGE_NAMES[state.stage] || state.stage;
    els.stageBadge.dataset.stage = state.stage;
    els.tokenBadge.textContent = state.token ? `会话 ${state.token.slice(0, 8)}` : "未开始";
}

function renderParticipantPanel() {
    const stageName = STAGE_NAMES[state.stage] || state.stage;
    els.participantId.textContent = state.token ? state.token : "未登录";
    els.participantStageState.textContent = stageName;

    if (!state.token || state.stage === "consent_pending") {
        els.participantConsentState.textContent = "待同意";
    } else if (state.stage === "withdrawn") {
        els.participantConsentState.textContent = "已撤回";
    } else {
        els.participantConsentState.textContent = "已同意";
    }

    els.participantResumeState.textContent = state.token ? "已保存，可续访" : "同意后自动保存";
    els.participantLoginBtn.disabled = state.isBusy;
    els.participantLogoutBtn.disabled = state.isBusy || !state.token;
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
    safeCookieWrite(introSeenCookieKey(state.token), "1", 120);
    syncUi();
}

function syncProgressPanel() {
    els.progressPanel.classList.toggle("visible", state.progressPanelVisible);
    els.progressPanel.classList.toggle("hover-open", state.progressHoverOpening);
    els.progressPanel.classList.toggle("fast-close", state.progressFastClosing);
    placeProgressPanelNearFab();
}

function clearProgressPanelTimer() {
    if (state.progressPanelTimer) {
        clearTimeout(state.progressPanelTimer);
        state.progressPanelTimer = null;
    }
}

function scheduleProgressPanelHide(delayMs, reason = "leave") {
    clearProgressPanelTimer();
    state.progressFastClosing = reason === "leave" || reason === "leave-fast" || reason === "passive";
    syncProgressPanel();
    const delay = Number.isFinite(delayMs) ? delayMs : adaptivePanelHideDelay(reason);
    state.progressPanelTimer = setTimeout(() => {
        if (state.progressHoverDepth > 0) return;
        state.progressPanelVisible = false;
        syncProgressPanel();
    }, delay);
}

function showProgressPanel(autoHideMs = null, reason = "manual") {
    clearProgressPanelTimer();
    state.progressFastClosing = false;
    state.progressHoverOpening = reason === "hover";
    state.progressPanelVisible = true;
    syncProgressPanel();
    if (reason === "hover" && autoHideMs === null) {
        return;
    }
    if (autoHideMs !== null) {
        if (autoHideMs > 0) scheduleProgressPanelHide(autoHideMs, reason);
        return;
    }
    scheduleProgressPanelHide(undefined, reason);
}

function hideProgressPanel() {
    clearProgressPanelTimer();
    state.progressFastClosing = true;
    state.progressPanelVisible = false;
    syncProgressPanel();
}

function toggleProgressPanel() {
    markProgressInteraction();
    if (state.progressFabMoved) {
        state.progressFabMoved = false;
        return;
    }
    if (state.progressPanelVisible) {
        hideProgressPanel();
        return;
    }
    showProgressPanel(adaptivePanelHideDelay("passive"), "passive");
}

function onProgressHoverEnter() {
    state.progressHoverDepth += 1;
    markProgressInteraction();
    state.progressHoverOpening = true;
    state.progressFastClosing = false;
    showProgressPanel(null, "hover");
}

function onProgressHoverLeave() {
    state.progressHoverDepth = Math.max(0, state.progressHoverDepth - 1);
    if (state.progressHoverDepth > 0) return;
    state.progressHoverOpening = false;
    scheduleProgressPanelHide(120, "leave-fast");
}

function startFabDrag(event) {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const rect = els.progressFab.getBoundingClientRect();
    state.progressPointerId = event.pointerId;
    state.progressDragOffsetX = event.clientX - rect.left;
    state.progressDragOffsetY = event.clientY - rect.top;
    state.progressFabMoved = false;
    markProgressInteraction();
    clearProgressPanelTimer();
    els.progressFab.setPointerCapture(event.pointerId);
}

function onFabDragMove(event) {
    if (state.progressPointerId !== event.pointerId) return;
    const size = fabSizePx();
    const nextX = event.clientX - state.progressDragOffsetX;
    const nextY = event.clientY - state.progressDragOffsetY;

    if (Math.abs(nextX - (state.fabX || 0)) > 1 || Math.abs(nextY - (state.fabY || 0)) > 1) {
        state.progressFabMoved = true;
    }

    state.fabX = clamp(nextX, FAB_MARGIN, Math.max(FAB_MARGIN, window.innerWidth - size - FAB_MARGIN));
    state.fabY = clamp(nextY, FAB_MARGIN, Math.max(FAB_MARGIN, window.innerHeight - size - FAB_MARGIN));
    applyFabPosition();
}

function endFabDrag(event) {
    if (state.progressPointerId !== event.pointerId) return;
    state.progressPointerId = null;
    state.progressLastDragAt = Date.now();
    saveFabPosition();

    if (state.progressFabMoved) {
        showProgressPanel(0, "drag");
        scheduleProgressPanelHide(undefined, "after_drag");
    }
}

function renderAdvanceStageBtn() {
    const overlayVisible = isOnboardingVisible() || isIntroVisible();
    const canAdvance = !state.isBusy && !overlayVisible && CHAT_STAGES.includes(state.stage) && state.stageReady;
    els.advanceStageBtn.classList.toggle("hidden", !canAdvance);
    if (!canAdvance) return;
    els.advanceStageBtn.textContent = state.stage === "wrapup" ? "进入草稿阶段" : "进入下一阶段";
}

function setBusy(flag) {
    state.isBusy = flag;
    const overlayVisible = isOnboardingVisible() || isIntroVisible();
    const chatEnabled = CHAT_STAGES.includes(state.stage) && !overlayVisible;
    const reviewEnabled = (state.stage === "review" || state.stage === "done") && !overlayVisible;

    els.userInput.disabled = flag || !chatEnabled;
    els.sendBtn.disabled = flag || !chatEnabled;
    els.skipBtn.disabled = flag || !chatEnabled;
    els.finalizeBtn.disabled = flag || !(state.stage === "wrapup" || state.stage === "review") || overlayVisible;

    els.overlayAgreeBtn.disabled = flag;
    els.overlayDeclineBtn.disabled = flag;
    els.introConfirmBtn.disabled = flag;
    els.participantLoginBtn.disabled = flag;
    els.participantLogoutBtn.disabled = flag || !state.token;
    els.adminEntryBtn.disabled = flag;
    els.adminShellCloseBtn.disabled = flag;

    els.reviseBtn.disabled = flag || !reviewEnabled;
    els.approveBtn.disabled = flag || !reviewEnabled;
    els.shuffleSparkBtn.disabled = flag || !chatEnabled;
    els.advanceStageBtn.disabled = flag;

    if (flag) {
        els.userInput.placeholder = "系统处理中...";
        if (els.speedHint) {
            els.speedHint.textContent = "助手思考中，可切换快速/中庸/深度（下一轮生效）";
        }
    } else {
        els.userInput.placeholder = "输入你的回答。双击 Enter 发送；Shift+Enter 换行；Cmd/Ctrl+Enter 立即发送。";
        renderSpeedControl();
    }
    renderAdvanceStageBtn();
}

function syncUi() {
    const showReview = state.stage === "review" || state.stage === "done";
    els.reviewActions.classList.toggle("visible", showReview);

    renderHeaderMeta();
    renderParticipantPanel();
    persistSessionSnapshot();
    renderProgressTrack();
    renderProgressSummary();
    renderGuide();
    syncOnboardingOverlay();
    syncIntroOverlay();
    syncProgressPanel();
    setBusy(false);

    if (state.stage === "consent_pending") {
        setStatus("等待同意后开始访谈");
    } else if (state.stage === "review") {
        setStatus("草稿已生成，建议先通读再改稿");
    } else if (state.stage === "done") {
        setStatus("定稿已完成，仍可继续修改");
    } else if (state.stage === "withdrawn") {
        setStatus("访谈已撤回，如需恢复请联系研究者");
    }
}

function createMessageEl(role, content, animate = true) {
    if (role === "system") {
        const wrap = document.createElement("article");
        wrap.className = "system-strip";
        if (!animate) wrap.style.animation = "none";

        const bubble = document.createElement("div");
        bubble.className = "system-strip-text";
        bubble.textContent = content;
        wrap.appendChild(bubble);
        return { wrap, bubble };
    }

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

function parseMetaJson(metaRaw) {
    if (!metaRaw) return {};
    if (typeof metaRaw === "object") return metaRaw;
    try {
        return JSON.parse(metaRaw);
    } catch {
        return {};
    }
}

function isCountedUserAnswer(msg) {
    if (!msg || msg.role !== "user") return false;
    const content = String(msg.content || "").trim();
    if (!content) return false;
    const meta = parseMetaJson(msg.meta_json);
    if (meta.type === "skip") return false;
    return true;
}

function userAnswerStage(msg) {
    const meta = parseMetaJson(msg?.meta_json);
    return typeof meta.stage === "string" ? meta.stage : "";
}

function stageMinAnswerCount(stage) {
    return STAGE_MIN_ANSWER_COUNT[stage] || 1;
}

function stageMinAnswerChars(stage) {
    return STAGE_MIN_ANSWER_CHARS[stage] || 20;
}

function applyExportStats(payload) {
    const countedUserMessages = (payload.messages || []).filter((m) => isCountedUserAnswer(m));
    const userCount = countedUserMessages.length;
    const draftCount = (payload.artifacts || []).filter((a) => a.type === "draft").length;
    const userChars = countedUserMessages.reduce((acc, m) => acc + String(m.content || "").trim().length, 0);

    els.statsBadge.textContent = `回答 ${userCount} 条 · ${userChars} 字 · 草稿 ${draftCount} 版`;

    state.stageReady = false;
    state.stageMissing = [];
    if (payload.readiness && payload.readiness.stages && payload.readiness.stages[state.stage]) {
        const info = payload.readiness.stages[state.stage];
        const stageAnswers = countedUserMessages.filter((m) => userAnswerStage(m) === state.stage);
        const stageAnswerCount = stageAnswers.length;
        const stageAnswerChars = stageAnswers.reduce((acc, m) => acc + String(m.content || "").trim().length, 0);
        const minCount = stageMinAnswerCount(state.stage);
        const minChars = stageMinAnswerChars(state.stage);

        const strictMissing = [];
        if (stageAnswerCount < minCount) strictMissing.push(`至少 ${minCount} 条本阶段有效回答（当前 ${stageAnswerCount} 条）`);
        if (stageAnswerChars < minChars) strictMissing.push(`至少 ${minChars} 字本阶段有效内容（当前 ${stageAnswerChars} 字）`);

        const baseMissing = Array.isArray(info.missing) ? info.missing : [];
        const mergedMissing = [...baseMissing, ...strictMissing];
        state.stageReady = Boolean(info.ready) && strictMissing.length === 0;
        state.stageMissing = mergedMissing;

        if (CHAT_STAGES.includes(state.stage) && mergedMissing.length) {
            setStatus(`当前阶段建议补充：${mergedMissing.slice(0, 2).join("；")}`);
        }
    }
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
