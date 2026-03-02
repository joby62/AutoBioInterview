const config = window.ParticipantConfig;
const utils = window.ParticipantUtils;

if (!config || !utils) {
    throw new Error("Participant boot scripts failed to load");
}

const {
    CHAT_STAGES,
    TRACK_STAGES,
    STAGE_NAMES,
    TRACK_LABELS,
    STAGE_HINTS,
    STAGE_THEME,
    STAGE_REQUIREMENT_TOTAL,
    STAGE_GUIDE,
    TOKEN_KEY,
    SPEED_PREF_KEY,
    FAB_POS_KEY,
    COOKIE_TOKEN_KEY,
    COOKIE_STAGE_KEY,
    COOKIE_CONSENT_KEY,
    FAST_MODEL_ID,
    BALANCED_MODEL_ID,
    DEEP_MODEL_ID,
    DEFAULT_MODELS,
    FAB_SIZE,
    FAB_MARGIN,
    STAGE_MIN_ANSWER_COUNT,
    STAGE_MIN_ANSWER_CHARS
} = config;

const {
    parseInviteCodeFromPath,
    safeStorageRead,
    safeStorageWrite,
    safeStorageRemove,
    safeCookieRead,
    safeCookieWrite,
    safeCookieRemove,
    normalizeStage,
    normalizeSpeedMode,
    parseErrorDetail
} = utils;

function readInitialToken() {
    return safeStorageRead(TOKEN_KEY, "") || safeCookieRead(COOKIE_TOKEN_KEY, "");
}

function readInitialStage() {
    return normalizeStage(safeCookieRead(COOKIE_STAGE_KEY, "consent_pending"));
}

function readInitialSpeedMode() {
    return normalizeSpeedMode(safeStorageRead(SPEED_PREF_KEY, "fast"));
}

const state = {
    token: readInitialToken(),
    stage: readInitialStage(),
    isBusy: false,
    lastDraft: "",
    toastTimer: null,
    enterPrimedAt: 0,
    availableModels: [...DEFAULT_MODELS],
    modelOrch: FAST_MODEL_ID,
    modelWrite: FAST_MODEL_ID,
    defaultModel: FAST_MODEL_ID,
    fastModel: FAST_MODEL_ID,
    balancedModel: BALANCED_MODEL_ID,
    deepModel: DEEP_MODEL_ID,
    speedMode: readInitialSpeedMode(),
    introSeenByToken: {},
    estimatedStepMinutes: 5,
    stageReady: false,
    stageMissing: [],
    progressPanelVisible: false,
    progressPanelTimer: null,
    progressHoverDepth: 0,
    progressHoverOpening: false,
    progressFastClosing: false,
    progressPointerId: null,
    progressDragOffsetX: 0,
    progressDragOffsetY: 0,
    progressFabMoved: false,
    progressLastDragAt: 0,
    progressLastInteractionAt: 0,
    rightsNoticeShown: false,
    progressPct: 0,
    fabDisplayMode: "percent",
    fabDisplayTimer: null,
    fabX: null,
    fabY: null
};

const els = {
    appShell: document.getElementById("appShell"),
    canvas: document.getElementById("celebrateCanvas"),
    stageBadge: document.getElementById("stageBadge"),
    tokenBadge: document.getElementById("tokenBadge"),
    statsBadge: document.getElementById("statsBadge"),
    speedFastBtn: document.getElementById("speedFastBtn"),
    speedBalancedBtn: document.getElementById("speedBalancedBtn"),
    speedDeepBtn: document.getElementById("speedDeepBtn"),
    speedHint: document.getElementById("speedHint"),
    participantId: document.getElementById("participantId"),
    participantStageState: document.getElementById("participantStageState"),
    participantConsentState: document.getElementById("participantConsentState"),
    participantResumeState: document.getElementById("participantResumeState"),
    participantTokenInput: document.getElementById("participantTokenInput"),
    participantLoginBtn: document.getElementById("participantLoginBtn"),
    participantLogoutBtn: document.getElementById("participantLogoutBtn"),
    adminEntryBtn: document.getElementById("adminEntryBtn"),
    messages: document.getElementById("messages"),
    wordCounter: document.getElementById("wordCounter"),
    statusLine: document.getElementById("statusLine"),
    userInput: document.getElementById("userInput"),
    skipBtn: document.getElementById("skipBtn"),
    finalizeBtn: document.getElementById("finalizeBtn"),
    reviewActions: document.getElementById("reviewActions"),
    viewDraftBtn: document.getElementById("viewDraftBtn"),
    reviseDraftTriggerBtn: document.getElementById("reviseDraftTriggerBtn"),
    approveFinalBtn: document.getElementById("approveFinalBtn"),
    advanceStageBtn: document.getElementById("advanceStageBtn"),
    sendBtn: document.getElementById("sendBtn"),
    progressFab: document.getElementById("progressFab"),
    progressFabPct: document.getElementById("progressFabPct"),
    progressPanel: document.getElementById("progressPanel"),
    progressPercent: document.getElementById("progressPercent"),
    progressEta: document.getElementById("progressEta"),
    progressFill: document.getElementById("progressFill"),
    progressTrack: document.getElementById("progressTrack"),
    progressBubble: document.getElementById("progressBubble"),
    progressStageHint: document.getElementById("progressStageHint"),
    progressStageEta: document.getElementById("progressStageEta"),
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
    adminShellModal: document.getElementById("adminShellModal"),
    adminShellCloseBtn: document.getElementById("adminShellCloseBtn"),
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

function introSeenCookieKey(token) {
    return token ? `abi_intro_seen_${token}` : "";
}

function hasSeenIntro() {
    if (!state.token) return false;
    if (state.introSeenByToken[state.token]) return true;
    if (safeStorageRead(introSeenKey(state.token), "") === "1") return true;
    return safeCookieRead(introSeenCookieKey(state.token), "") === "1";
}

function shouldShowIntroOverlay() {
    if (!state.token) return false;
    if (state.stage === "consent_pending" || state.stage === "withdrawn") return false;
    return !hasSeenIntro();
}

function isIntroVisible() {
    return shouldShowIntroOverlay();
}

function persistSessionSnapshot() {
    const token = String(state.token || "").trim();
    if (!token) {
        safeStorageRemove(TOKEN_KEY);
        safeCookieRemove(COOKIE_TOKEN_KEY);
        safeCookieRemove(COOKIE_STAGE_KEY);
        safeCookieRemove(COOKIE_CONSENT_KEY);
        return;
    }

    safeStorageWrite(TOKEN_KEY, token);
    safeCookieWrite(COOKIE_TOKEN_KEY, token, 120);
    safeCookieWrite(COOKIE_STAGE_KEY, normalizeStage(state.stage), 120);

    const consented = state.stage !== "consent_pending" && state.stage !== "withdrawn";
    safeCookieWrite(COOKIE_CONSENT_KEY, consented ? "1" : "0", 120);
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

function stageCompletionRatio(stage, missingItems, stageReady) {
    if (stageReady) return 1;
    const total = STAGE_REQUIREMENT_TOTAL[stage] ?? 2;
    if (total <= 0) return 1;
    const missing = Math.max(0, Math.min(total, (missingItems || []).length));
    const done = total - missing;
    return Math.max(0, Math.min(1, done / total));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function rangeText(low, high) {
    const a = Math.max(0, Math.round(low));
    const b = Math.max(a, Math.round(high));
    return `${a}-${b} min`;
}

function markProgressInteraction() {
    state.progressLastInteractionAt = Date.now();
}

function adaptivePanelHideDelay(reason = "leave") {
    if (reason === "stage_complete") return 5200;

    let delay = 760;
    const now = Date.now();
    if (now - state.progressLastInteractionAt < 1600) delay += 220;
    if (now - state.progressLastDragAt < 1800) delay += 340;
    if (state.isBusy) delay += 180;
    return clamp(delay, 700, 1600);
}

function saveFabPosition() {
    safeStorageWrite(FAB_POS_KEY, JSON.stringify({ x: state.fabX, y: state.fabY }));
}

function loadFabPosition() {
    const raw = safeStorageRead(FAB_POS_KEY, "");
    if (!raw) return;
    try {
        const pos = JSON.parse(raw);
        if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            state.fabX = pos.x;
            state.fabY = pos.y;
        }
    } catch {
        // noop
    }
}

function fabSizePx() {
    return Math.max(44, els.progressFab.offsetWidth || FAB_SIZE);
}

function applyFabPosition() {
    const size = fabSizePx();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(FAB_MARGIN, vw - size - FAB_MARGIN);
    const maxY = Math.max(FAB_MARGIN, vh - size - FAB_MARGIN);
    const preferredInset = Math.min(52, Math.max(24, Math.round(vw * 0.035)));

    if (!Number.isFinite(state.fabX) || !Number.isFinite(state.fabY)) {
        state.fabX = Math.max(FAB_MARGIN, maxX - preferredInset);
        state.fabY = maxY;
    }

    if (state.fabX > maxX - 8) {
        state.fabX = Math.max(FAB_MARGIN, maxX - preferredInset);
    }

    state.fabX = clamp(state.fabX, FAB_MARGIN, maxX);
    state.fabY = clamp(state.fabY, FAB_MARGIN, maxY);

    els.progressFab.style.left = `${state.fabX}px`;
    els.progressFab.style.top = `${state.fabY}px`;
    els.progressFab.style.right = "auto";
    els.progressFab.style.bottom = "auto";
    placeProgressPanelNearFab();
}

function placeProgressPanelNearFab() {
    const panel = els.progressPanel;
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width || Math.min(700, window.innerWidth - 28);
    const panelHeight = panelRect.height || 240;
    const size = fabSizePx();
    const margin = 10;
    const anchorX = (state.fabX ?? 0) + size * 0.5;
    const anchorY = (state.fabY ?? 0) + size * 0.5;

    let left = anchorX - panelWidth + size * 0.55;
    let top = anchorY - panelHeight - size * 0.6;

    left = clamp(left, margin, Math.max(margin, window.innerWidth - panelWidth - margin));
    if (top < margin) {
        top = anchorY + size * 0.6;
    }
    top = clamp(top, margin, Math.max(margin, window.innerHeight - panelHeight - margin));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
}


bootstrap();
