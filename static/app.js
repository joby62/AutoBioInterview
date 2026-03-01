const STAGES = ["consent_pending", "daily", "evolution", "experience", "difficulty", "impact", "wrapup", "review", "done", "withdrawn"];
const CHAT_STAGES = ["daily", "evolution", "experience", "difficulty", "impact", "wrapup"];
const TRACK_STAGES = ["consent_pending", "daily", "evolution", "experience", "difficulty", "impact", "wrapup", "review", "done"];

const STAGE_NAMES = {
    consent_pending: "待同意",
    daily: "日常",
    evolution: "演变",
    experience: "体验",
    difficulty: "困难",
    impact: "影响",
    wrapup: "补漏",
    review: "审阅",
    done: "完成",
    withdrawn: "撤回"
};

const STAGE_GUIDE = {
    consent_pending: {
        title: "先确认边界，再开始",
        desc: "你始终有拒答、跳过、撤回和修改权。",
        sparks: []
    },
    daily: {
        title: "从“最近一次”开始讲",
        desc: "告诉我具体平台、时间、内容、场景。",
        sparks: [
            "最近一次是昨晚11点，我在B站学了40分钟。",
            "我常在通勤时刷知识内容，睡前再整理笔记。",
            "我每周末会做一次2小时的集中学习。",
            "我现在最常用的平台是____，主要学____。"
        ]
    },
    evolution: {
        title: "讲清变化的前后",
        desc: "用一个关键节点解释学习方式是怎么变的。",
        sparks: [
            "找工作那年，我从碎片信息转到系统课程。",
            "入职后我学习更偏向解决当下项目问题。",
            "某次失败让我换了学习节奏和方法。",
            "之前我主要____，现在我更重视____。"
        ]
    },
    experience: {
        title: "把情绪放进故事",
        desc: "不要只写“焦虑”，讲触发情绪的具体瞬间。",
        sparks: [
            "那次连续打卡让我很满足，但也开始疲惫。",
            "直播自习让我更能坚持，但结束后会空落。",
            "我开始意识到自己容易追求“高效感”。",
            "最难忘的一次是____，因为____。"
        ]
    },
    difficulty: {
        title: "困难和策略要成对出现",
        desc: "每个困难后，补一句“我怎么应对，效果怎样”。",
        sparks: [
            "我会先限定主题，避免全平台漫游。",
            "番茄钟前30分钟有效，后面仍会分心。",
            "每周复盘后，我的焦虑明显下降。",
            "我遇到的最大阻碍是____，我试过____。"
        ]
    },
    impact: {
        title: "扩展到生活影响",
        desc: "不仅是学习成绩，也包括关系、作息和自我认同。",
        sparks: [
            "学习效率提高了，但休息时间被压缩。",
            "我更愿意分享知识，但也更怕落后。",
            "持续学习已经变成我的自我要求。",
            "我最珍视的是____，最矛盾的是____。"
        ]
    },
    wrapup: {
        title: "最后补一条关键故事",
        desc: "检查是否有遗漏，或需要进一步匿名化。",
        sparks: [
            "还有一段我希望写进自传的经历：",
            "请把我提到的单位统一匿名化。",
            "我没有更多补充，可以进入草稿阶段。",
            "我最想保留的一段反思是____。"
        ]
    },
    review: {
        title: "草稿审阅中",
        desc: "先读草稿，再给具体修改指令。",
        sparks: []
    },
    done: {
        title: "已定稿",
        desc: "如果还想微调，可以继续改稿。",
        sparks: []
    },
    withdrawn: {
        title: "会话已撤回",
        desc: "当前会话停止，可重新开启新访谈。",
        sparks: []
    }
};

const CIRCUMFERENCE = 2 * Math.PI * 48;

const state = {
    token: localStorage.getItem("interview_token") || "",
    stage: "consent_pending",
    isBusy: false,
    lastDraft: "",
    toastTimer: null,
    particleTimer: null,
    firstInteractiveMessage: true
};

const els = {
    orbA: document.querySelector(".orb-a"),
    orbB: document.querySelector(".orb-b"),
    canvas: document.getElementById("celebrateCanvas"),
    heroCard: document.getElementById("heroCard"),
    progressTrack: document.getElementById("progressTrack"),
    progressRingStroke: document.getElementById("progressRingStroke"),
    progressRingText: document.getElementById("progressRingText"),
    stageBadge: document.getElementById("stageBadge"),
    tokenBadge: document.getElementById("tokenBadge"),
    statsBadge: document.getElementById("statsBadge"),
    guideTitle: document.getElementById("guideTitle"),
    guideDesc: document.getElementById("guideDesc"),
    quickChips: document.getElementById("quickChips"),
    shuffleSparkBtn: document.getElementById("shuffleSparkBtn"),
    consentCard: document.getElementById("consentCard"),
    consentAgreeBtn: document.getElementById("consentAgreeBtn"),
    consentRejectBtn: document.getElementById("consentRejectBtn"),
    messages: document.getElementById("messages"),
    wordCounter: document.getElementById("wordCounter"),
    statusLine: document.getElementById("statusLine"),
    userInput: document.getElementById("userInput"),
    sendBtn: document.getElementById("sendBtn"),
    newInterviewBtn: document.getElementById("newInterviewBtn"),
    withdrawBtn: document.getElementById("withdrawBtn"),
    skipBtn: document.getElementById("skipBtn"),
    altBtn: document.getElementById("altBtn"),
    finalizeBtn: document.getElementById("finalizeBtn"),
    reviewActions: document.getElementById("reviewActions"),
    altModal: document.getElementById("altModal"),
    altType: document.getElementById("altType"),
    altUrl: document.getElementById("altUrl"),
    altTranscript: document.getElementById("altTranscript"),
    altNote: document.getElementById("altNote"),
    altSubmitBtn: document.getElementById("altSubmitBtn"),
    draftModal: document.getElementById("draftModal"),
    draftContent: document.getElementById("draftContent"),
    reviseInstruction: document.getElementById("reviseInstruction"),
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

function roleLabel(role) {
    if (role === "user") return "受访者";
    if (role === "assistant") return "访谈助手";
    return "系统提示";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function stageIndex(stage) {
    return TRACK_STAGES.indexOf(stage);
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function autosizeTextarea() {
    const el = els.userInput;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

function updateWordCounter() {
    const text = els.userInput.value.trim();
    const count = text.length;
    els.wordCounter.textContent = `${count} 字`;
}

function setStatus(text) {
    els.statusLine.textContent = text || "";
}

function setBusy(flag) {
    state.isBusy = flag;
    const chatEnabled = CHAT_STAGES.includes(state.stage);
    const reviewEnabled = state.stage === "review" || state.stage === "done";

    els.sendBtn.disabled = flag || !chatEnabled;
    els.userInput.disabled = flag || !chatEnabled;
    els.skipBtn.disabled = flag || !chatEnabled;
    els.altBtn.disabled = flag || !chatEnabled;
    els.finalizeBtn.disabled = flag || !(state.stage === "wrapup" || state.stage === "review");
    els.withdrawBtn.disabled = flag || !state.token || state.stage === "withdrawn";
    els.newInterviewBtn.disabled = flag;
    els.consentAgreeBtn.disabled = flag || state.stage !== "consent_pending";
    els.consentRejectBtn.disabled = flag || state.stage !== "consent_pending";
    els.altSubmitBtn.disabled = flag;
    els.reviseBtn.disabled = flag || !reviewEnabled;
    els.approveBtn.disabled = flag || !reviewEnabled;
    els.shuffleSparkBtn.disabled = flag;

    if (flag) {
        els.userInput.placeholder = "系统处理中...";
    } else {
        els.userInput.placeholder = "输入你的回答（回车发送，Shift+回车换行）";
    }
}

function renderProgressTrack() {
    const active = state.stage;
    const activeIndex = stageIndex(active);

    els.progressTrack.innerHTML = TRACK_STAGES.map((stage) => {
        const idx = stageIndex(stage);
        let className = "track-item";
        if (active === stage) className += " active";
        if (activeIndex >= 0 && idx < activeIndex) className += " done";
        return `<span class="${className}">${STAGE_NAMES[stage]}</span>`;
    }).join("");
}

function renderProgressRing() {
    const idx = stageIndex(state.stage);
    const ratio = idx < 0 ? 0 : idx / (TRACK_STAGES.length - 1);
    const pct = Math.round(ratio * 100);
    const dash = CIRCUMFERENCE * (1 - ratio);
    els.progressRingStroke.style.strokeDasharray = `${CIRCUMFERENCE}`;
    els.progressRingStroke.style.strokeDashoffset = `${dash}`;
    els.progressRingText.textContent = `${pct}%`;
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

    const sample = shuffle(sparks).slice(0, 3);
    els.shuffleSparkBtn.disabled = state.isBusy;
    els.quickChips.innerHTML = sample
        .map((spark) => `<button class="spark-chip" type="button" data-chip="${spark.replace(/"/g, "&quot;")}">${spark}</button>`)
        .join("");
}

function shuffleSparks() {
    const guide = STAGE_GUIDE[state.stage] || { sparks: [] };
    if (!guide.sparks || guide.sparks.length === 0) return;
    els.quickChips.classList.add("shuffle");
    renderSparkChips(guide.sparks);
    setTimeout(() => {
        els.quickChips.classList.remove("shuffle");
    }, 180);
}

function syncUi() {
    const showConsent = state.stage === "consent_pending";
    const showReview = state.stage === "review" || state.stage === "done";

    els.consentCard.classList.toggle("visible", showConsent);
    els.reviewActions.classList.toggle("visible", showReview);

    renderHeaderMeta();
    renderProgressTrack();
    renderProgressRing();
    renderGuide();
    setBusy(false);

    if (state.stage === "consent_pending") {
        setStatus("请先确认知情同意。你可随时退出或撤回。");
    } else if (state.stage === "review") {
        setStatus("草稿已生成，建议先通读再给修改指令。");
    } else if (state.stage === "done") {
        setStatus("已定稿完成。仍可继续修改后再次定稿。");
    } else if (state.stage === "withdrawn") {
        setStatus("当前会话已撤回。可开启新访谈继续。");
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
    if (scroll) {
        els.messages.scrollTop = els.messages.scrollHeight;
    }
    return node;
}

async function appendAssistantTypewriter(content) {
    const node = createMessageEl("assistant", "", true);
    els.messages.appendChild(node.wrap);
    els.messages.scrollTop = els.messages.scrollHeight;

    const speed = content.length > 140 ? 8 : 12;
    let out = "";
    for (const ch of content) {
        out += ch;
        node.bubble.textContent = out;
        els.messages.scrollTop = els.messages.scrollHeight;
        await sleep(speed);
    }
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

function applyExportStats(payload) {
    const userCount = (payload.messages || []).filter((m) => m.role === "user").length;
    const draftCount = (payload.artifacts || []).filter((a) => a.type === "draft").length;
    const userChars = (payload.messages || [])
        .filter((m) => m.role === "user")
        .reduce((acc, m) => acc + (m.content || "").length, 0);

    els.statsBadge.textContent = `回答 ${userCount} 条 · ${userChars} 字 · 草稿 ${draftCount} 版`;

    if (payload.readiness && payload.readiness.stages && payload.readiness.stages[state.stage]) {
        const stageInfo = payload.readiness.stages[state.stage];
        if (CHAT_STAGES.includes(state.stage) && Array.isArray(stageInfo.missing) && stageInfo.missing.length) {
            setStatus(`建议补充：${stageInfo.missing.slice(0, 2).join("；")}`);
        }
    }
}

function detectStageAdvance(prevStage, nextStage) {
    const prev = stageIndex(prevStage);
    const next = stageIndex(nextStage);
    return prev >= 0 && next > prev;
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
    const count = Math.floor(36 * intensity);
    const startX = confetti.width * 0.5;
    const startY = Math.max(100, confetti.height * 0.18);

    for (let i = 0; i < count; i++) {
        confetti.particles.push({
            x: startX,
            y: startY,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * -8 - 2,
            g: 0.19 + Math.random() * 0.08,
            life: 64 + Math.random() * 28,
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

function attachHeroInteraction() {
    els.heroCard.addEventListener("pointermove", (event) => {
        const rect = els.heroCard.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        els.heroCard.style.transform = `perspective(900px) rotateX(${(-py * 2.6).toFixed(2)}deg) rotateY(${(px * 2.6).toFixed(2)}deg)`;
        els.orbA.style.transform = `translate(${px * -14}px, ${py * -10}px)`;
        els.orbB.style.transform = `translate(${px * 16}px, ${py * 12}px)`;
    });

    els.heroCard.addEventListener("pointerleave", () => {
        els.heroCard.style.transform = "";
        els.orbA.style.transform = "";
        els.orbB.style.transform = "";
    });
}

async function refreshState(fullRefresh = false) {
    if (!state.token) {
        state.stage = "consent_pending";
        els.messages.innerHTML = "";
        appendMessage("assistant", "你好，点击“开启新访谈”，先完成知情同意，再开始对话。", { animate: false });
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

        const latestDraft = (data.artifacts || []).find((item) => item.type === "draft");
        if (latestDraft && latestDraft.content) {
            state.lastDraft = latestDraft.content;
            els.draftContent.textContent = state.lastDraft;
        }

        syncUi();
    } catch (err) {
        localStorage.removeItem("interview_token");
        state.token = "";
        state.stage = "consent_pending";
        els.messages.innerHTML = "";
        appendMessage("system", "当前 token 不可用，已为你重置会话。", { animate: false });
        syncUi();
        showToast(String(err.message || err), "error");
    }
}

function updateStageFromNextPayload(data, prevStage) {
    state.stage = data.should_advance_stage ? data.suggested_next_stage : data.stage;

    if (detectStageAdvance(prevStage, state.stage)) {
        spawnConfetti(1);
        showToast(`进入 ${STAGE_NAMES[state.stage]} 阶段`, "success");
    }

    if (Array.isArray(data.missing_requirements) && data.missing_requirements.length) {
        setStatus(`当前阶段建议补充：${data.missing_requirements.slice(0, 2).join("；")}`);
    } else if (data.stage_ready) {
        setStatus("当前阶段信息已达标，继续聊下去即可推进阶段。");
    }
}

function openAltModal() {
    if (!state.token || state.isBusy) return;
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
    }, 120);
}

function onBackdropClose(event, modalId) {
    if (event.target.id !== modalId) return;
    if (modalId === "altModal") closeAltModal();
    if (modalId === "draftModal") closeDraftModal();
}

function handleInputKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
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
        localStorage.setItem("interview_token", state.token);
        state.lastDraft = "";
        els.draftContent.textContent = "尚未生成草稿。";
        els.reviseInstruction.value = "";
        await refreshState(true);
        showToast("已创建新访谈", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function handleConsent(agreed) {
    if (state.isBusy || !state.token) return;

    setBusy(true);
    try {
        const data = await api("/consent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, agreed })
        });
        const prev = state.stage;
        state.stage = data.stage || (agreed ? "daily" : "withdrawn");
        await refreshState(true);

        if (detectStageAdvance(prev, state.stage)) {
            spawnConfetti(0.9);
        }

        showToast(agreed ? "已同意并进入访谈" : "已记录不同意参与", agreed ? "success" : "");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function sendMessage() {
    if (state.isBusy || !state.token || !CHAT_STAGES.includes(state.stage)) return;

    const content = els.userInput.value.trim();
    if (!content) return;

    setBusy(true);
    els.userInput.value = "";
    autosizeTextarea();
    updateWordCounter();

    appendMessage("user", content);
    const typingBubble = appendThinkingBubble();

    try {
        await api("/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, content })
        });

        const prevStage = state.stage;
        const data = await api(`/next?token=${encodeURIComponent(state.token)}`, { method: "POST" });

        typingBubble.remove();
        const q = (data.questions || []).join("\n") || "我再换个角度继续追问。";
        await appendAssistantTypewriter(q);

        if (data.rights_notice) {
            appendMessage("system", data.rights_notice);
        }

        updateStageFromNextPayload(data, prevStage);
        syncUi();

        if (state.firstInteractiveMessage) {
            state.firstInteractiveMessage = false;
            showToast("你已经进入“叙事状态”，继续保持具体细节。", "success");
        }
    } catch (err) {
        typingBubble.remove();
        appendMessage("system", String(err.message || err));
    } finally {
        setBusy(false);
    }
}

async function skipQuestion() {
    if (state.isBusy || !state.token || !CHAT_STAGES.includes(state.stage)) return;

    setBusy(true);
    const typingBubble = appendThinkingBubble("正在换个问法");

    try {
        const prevStage = state.stage;
        const data = await api("/skip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, reason: "" })
        });

        typingBubble.remove();
        await appendAssistantTypewriter((data.questions || []).join("\n") || "没问题，我们继续。");
        if (data.rights_notice) appendMessage("system", data.rights_notice);
        updateStageFromNextPayload(data, prevStage);
        syncUi();
    } catch (err) {
        typingBubble.remove();
        appendMessage("system", String(err.message || err));
    } finally {
        setBusy(false);
    }
}

async function withdrawInterview() {
    if (state.isBusy || !state.token) return;
    if (!confirm("确认撤回当前访谈？撤回后该会话不会继续。")) return;

    setBusy(true);
    try {
        const data = await api("/withdraw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token, reason: "" })
        });
        state.stage = data.stage || "withdrawn";
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

        closeAltModal();
        els.altUrl.value = "";
        els.altTranscript.value = "";
        els.altNote.value = "";

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
        showToast("草稿已生成，可以继续润色", "success");
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
        spawnConfetti(1.35);
        showToast("定稿完成，干得漂亮", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

function attachEvents() {
    document.addEventListener("click", (event) => {
        const chip = event.target.closest(".spark-chip");
        if (chip && !state.isBusy) {
            const content = chip.dataset.chip || chip.textContent;
            const current = els.userInput.value.trim();
            els.userInput.value = current ? `${current}\n${content}` : content;
            autosizeTextarea();
            updateWordCounter();
            els.userInput.focus();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAltModal();
            closeDraftModal();
        }
    });

    els.userInput.addEventListener("input", () => {
        autosizeTextarea();
        updateWordCounter();
    });

    window.addEventListener("resize", ensureCanvasSize);
}

async function bootstrap() {
    ensureCanvasSize();
    attachHeroInteraction();
    attachEvents();

    syncUi();
    autosizeTextarea();
    updateWordCounter();
    await refreshState(true);
}

bootstrap();
