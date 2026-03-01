    const STAGES = ["consent_pending", "daily", "evolution", "experience", "difficulty", "impact", "wrapup", "review", "done", "withdrawn"];
    const CHAT_STAGES = ["daily", "evolution", "experience", "difficulty", "impact", "wrapup"];
    const TRACK_STAGES = ["consent_pending", "daily", "evolution", "experience", "difficulty", "impact", "wrapup", "review", "done"];

    const STAGE_NAMES = {
        consent_pending: "知情同意",
        daily: "日常节奏",
        evolution: "阶段演变",
        experience: "体验情绪",
        difficulty: "困难应对",
        impact: "影响反思",
        wrapup: "补漏收尾",
        review: "草稿审阅",
        done: "访谈完成",
        withdrawn: "已撤回"
    };

    const STAGE_HINTS = {
        consent_pending: "确认权益与边界",
        daily: "平台、时间、内容",
        evolution: "阶段变化与节点",
        experience: "具体感受和事件",
        difficulty: "困难与策略有效性",
        impact: "多维影响与矛盾",
        wrapup: "补齐缺口和匿名确认",
        review: "检查并修改草稿",
        done: "可继续修改或撤回"
    };

    const STAGE_GUIDE = {
        consent_pending: {
            title: "先确认参与边界",
            desc: "你的叙述将用于学术研究，但你始终保有拒答、跳过、撤回与修改权。",
            checklist: [
                "确认你理解用途与匿名化规则。",
                "不想回答的问题直接跳过即可。",
                "随时可以撤回当前访谈。"
            ],
            examples: ["权益优先", "可暂停", "可撤回"],
            chips: []
        },
        daily: {
            title: "锁定最近一次学习场景",
            desc: "优先给出“最近一次”而不是长期概括，细节越具体越好。",
            checklist: [
                "说清平台、学习内容、时间段。",
                "补充当时环境：在家/通勤/工作间隙。",
                "描述节奏：每天、每周还是临时突击。"
            ],
            examples: ["最近48小时", "真实细节", "不需要文采"],
            chips: [
                "最近一次是昨晚11点，我在B站学了40分钟。",
                "我通常在通勤时刷内容，睡前再做一次整理。",
                "周末会集中学习2小时，工作日偏碎片化。"
            ]
        },
        evolution: {
            title: "讲变化，不讲空话",
            desc: "从某个关键节点切入，说明“之前怎样、之后怎样、为什么变”。",
            checklist: [
                "给出至少一个关键转折事件。",
                "对比不同阶段的方法和目标。",
                "说明变化背后的触发因素。"
            ],
            examples: ["前后对比", "关键节点", "触发原因"],
            chips: [
                "找工作那年我从刷资讯转成系统课程学习。",
                "入职后学习从考试导向变成解决项目问题。",
                "一次失败经历让我换了学习方法。"
            ]
        },
        experience: {
            title: "把感受放进故事",
            desc: "不要只写“焦虑/充实”，要说明是什么场景让你产生了这种感受。",
            checklist: [
                "说一段难忘经历。",
                "写清情绪起伏与原因。",
                "补一句你对自己的新认识。"
            ],
            examples: ["情绪变化", "难忘片段", "自我认知"],
            chips: [
                "那次连续打卡让我很有成就感，但也开始疲惫。",
                "直播自习时我能坚持，但结束后会空落。",
                "我发现自己容易被“高效感”吸引而忽略理解。"
            ]
        },
        difficulty: {
            title: "困难与策略要成对出现",
            desc: "每个困难后面都尽量补上你试过的方法，以及有效/无效结论。",
            checklist: [
                "描述具体困难，不要只写“信息太多”。",
                "给出你尝试过的策略。",
                "说明结果：为什么有效或无效。"
            ],
            examples: ["信息过载", "注意力管理", "策略复盘"],
            chips: [
                "我会先限定一个主题，不再全平台漫游。",
                "番茄钟对我前30分钟有效，后面还是会分心。",
                "做每周复盘后，焦虑明显下降。"
            ]
        },
        impact: {
            title: "扩展到生活影响",
            desc: "影响不仅是成绩或绩效，也包括关系、作息、价值观和自我认同。",
            checklist: [
                "至少写两个影响维度。",
                "补充你最珍视和最矛盾的部分。",
                "描述一个具体后果或变化。"
            ],
            examples: ["学业职业", "关系作息", "认同矛盾"],
            chips: [
                "它让我工作提效，但也压缩了休息时间。",
                "我更主动分享知识，但也更怕落后。",
                "我开始把“持续学习”当成自我要求。"
            ]
        },
        wrapup: {
            title: "收尾补漏",
            desc: "最后检查有没有关键故事遗漏，或需要进一步匿名化的内容。",
            checklist: [
                "补一条“必须写进自传”的故事。",
                "检查是否含姓名、单位、具体地址。",
                "确认是否需要替换为“某公司/某城市”。"
            ],
            examples: ["关键补充", "匿名化确认", "准备生成草稿"],
            chips: [
                "还有一段关键经历我想补充：",
                "请把我提到的单位都匿名成“某公司”。",
                "我没有更多补充了，可以进入草稿阶段。"
            ]
        },
        review: {
            title: "草稿审阅与定向修改",
            desc: "先通读草稿，再给出精准修改指令，比如“补细节”“弱化说教”“删敏感信息”。",
            checklist: [
                "检查五个模块是否都覆盖。",
                "指出希望增强或删减的段落。",
                "满意后再确认定稿。"
            ],
            examples: ["补细节", "删敏感信息", "调整语气"],
            chips: []
        },
        done: {
            title: "已完成，可继续管理",
            desc: "你已经完成定稿；如仍需微调，可继续修改草稿后再确认。",
            checklist: [
                "可查看草稿并继续迭代。",
                "如需退出研究流程，可撤回访谈。",
                "保留你认为必要的隐私边界。"
            ],
            examples: ["已完成", "可再修改", "可撤回"],
            chips: []
        },
        withdrawn: {
            title: "访谈已撤回",
            desc: "当前会话已终止，不再继续提问。你可以重新开启新的访谈会话。",
            checklist: [
                "当前 token 不再继续使用。",
                "如需继续，请开启新访谈。"
            ],
            examples: ["会话终止"],
            chips: []
        }
    };

    const THEME_KEY = "interview_ui_theme";
    const THEMES = ["aurora", "editorial"];
    const THEME_LABEL = {
        aurora: "Aurora",
        editorial: "Editorial"
    };

    const state = {
        token: localStorage.getItem("interview_token") || "",
        stage: "consent_pending",
        isBusy: false,
        lastDraft: "",
        toastTimer: null,
        theme: localStorage.getItem(THEME_KEY) || "aurora"
    };

    const els = {
        stageRail: document.getElementById("stageRail"),
        guideTitle: document.getElementById("guideTitle"),
        guideDesc: document.getElementById("guideDesc"),
        guideList: document.getElementById("guideList"),
        guideExamples: document.getElementById("guideExamples"),
        stageBadge: document.getElementById("stageBadge"),
        tokenBadge: document.getElementById("tokenBadge"),
        statsBadge: document.getElementById("statsBadge"),
        consentStrip: document.getElementById("consentStrip"),
        consentAgreeBtn: document.getElementById("consentAgreeBtn"),
        consentRejectBtn: document.getElementById("consentRejectBtn"),
        messages: document.getElementById("messages"),
        quickChips: document.getElementById("quickChips"),
        userInput: document.getElementById("userInput"),
        sendBtn: document.getElementById("sendBtn"),
        themeToggleBtn: document.getElementById("themeToggleBtn"),
        newInterviewBtn: document.getElementById("newInterviewBtn"),
        withdrawBtn: document.getElementById("withdrawBtn"),
        skipBtn: document.getElementById("skipBtn"),
        altBtn: document.getElementById("altBtn"),
        finalizeBtn: document.getElementById("finalizeBtn"),
        reviewActions: document.getElementById("reviewActions"),
        statusLine: document.getElementById("statusLine"),
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

    function applyTheme(themeName) {
        const theme = THEMES.includes(themeName) ? themeName : "aurora";
        state.theme = theme;
        document.body.dataset.theme = theme === "aurora" ? "" : theme;
        localStorage.setItem(THEME_KEY, theme);
        if (els.themeToggleBtn) {
            const nextTheme = theme === "aurora" ? "editorial" : "aurora";
            els.themeToggleBtn.textContent = `主题: ${THEME_LABEL[theme]} -> ${THEME_LABEL[nextTheme]}`;
        }
    }

    function toggleTheme() {
        const nextTheme = state.theme === "aurora" ? "editorial" : "aurora";
        applyTheme(nextTheme);
        showToast(`已切换为 ${THEME_LABEL[nextTheme]} 主题`, "success");
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

    function roleLabel(role) {
        if (role === "user") return "受访者";
        if (role === "assistant") return "访谈助手";
        return "系统提示";
    }

    function stageIndex(stage) {
        return TRACK_STAGES.indexOf(stage);
    }

    function renderStageRail() {
        const active = state.stage;
        const activeIndex = stageIndex(active);

        els.stageRail.innerHTML = TRACK_STAGES.map((s, i) => {
            let className = "stage-item";
            if (s === active) className += " active";
            if (activeIndex >= 0 && i < activeIndex) className += " completed";
            if (active === "withdrawn" && i > 0) className += " blocked";
            return `
                <div class="${className}">
                    <div class="stage-dot">${i + 1}</div>
                    <div class="stage-copy">
                        <div class="stage-name">${STAGE_NAMES[s] || s}</div>
                        <div class="stage-hint">${STAGE_HINTS[s] || ""}</div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderGuide() {
        const guide = STAGE_GUIDE[state.stage] || STAGE_GUIDE.consent_pending;
        els.guideTitle.textContent = guide.title;
        els.guideDesc.textContent = guide.desc;

        els.guideList.innerHTML = guide.checklist
            .map((item) => `<li>${item}</li>`)
            .join("");

        els.guideExamples.innerHTML = (guide.examples || [])
            .map((item) => `<span class="example-pill">${item}</span>`)
            .join("");

        renderQuickChips(guide.chips || []);
    }

    function renderQuickChips(chips) {
        if (!chips.length || !CHAT_STAGES.includes(state.stage)) {
            els.quickChips.innerHTML = "";
            return;
        }

        els.quickChips.innerHTML = chips
            .map((chip) => `<button class="quick-chip" type="button" data-chip="${chip.replace(/"/g, "&quot;")}">${chip}</button>`)
            .join("");
    }

    function appendToInput(text) {
        if (!text) return;
        const current = els.userInput.value.trim();
        els.userInput.value = current ? `${current}\n${text}` : text;
        els.userInput.focus();
        els.userInput.setSelectionRange(els.userInput.value.length, els.userInput.value.length);
    }

    function createMessageEl(role, content, typing = false) {
        const wrap = document.createElement("article");
        wrap.className = `message ${role}`;

        const label = document.createElement("div");
        label.className = "message-role";
        label.textContent = roleLabel(role);

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        if (typing) bubble.classList.add("typing");
        bubble.textContent = content;

        wrap.appendChild(label);
        wrap.appendChild(bubble);
        return { wrap, bubble };
    }

    function appendMessage(role, content, opts = {}) {
        const { typing = false, scroll = true, animate = true } = opts;
        const { wrap, bubble } = createMessageEl(role, content, typing);
        if (!animate) wrap.style.animation = "none";
        els.messages.appendChild(wrap);
        if (scroll) els.messages.scrollTop = els.messages.scrollHeight;
        return { wrap, bubble };
    }

    function setStatus(text) {
        els.statusLine.textContent = text || "";
    }

    function syncHeader() {
        const stageName = STAGE_NAMES[state.stage] || state.stage;
        els.stageBadge.textContent = stageName;
        els.stageBadge.dataset.stage = state.stage;

        if (state.token) {
            els.tokenBadge.textContent = `会话 ${state.token.slice(0, 8)}`;
        } else {
            els.tokenBadge.textContent = "未开始";
        }
    }

    function setBusy(flag) {
        state.isBusy = flag;
        const chatEnabled = CHAT_STAGES.includes(state.stage);
        const inReview = state.stage === "review" || state.stage === "done";

        els.sendBtn.disabled = flag || !chatEnabled;
        els.userInput.disabled = flag || !chatEnabled;
        els.skipBtn.disabled = flag || !chatEnabled;
        els.altBtn.disabled = flag || !chatEnabled;
        els.finalizeBtn.disabled = flag || !(state.stage === "wrapup" || state.stage === "review");
        els.withdrawBtn.disabled = flag || !state.token || state.stage === "withdrawn";
        els.newInterviewBtn.disabled = flag;
        if (els.themeToggleBtn) els.themeToggleBtn.disabled = flag;
        els.consentAgreeBtn.disabled = flag || state.stage !== "consent_pending";
        els.consentRejectBtn.disabled = flag || state.stage !== "consent_pending";
        els.altSubmitBtn.disabled = flag;
        els.reviseBtn.disabled = flag || !inReview;
        els.approveBtn.disabled = flag || !inReview;

        els.userInput.placeholder = flag ? "系统处理中..." : "输入你的回答（回车发送，Shift+回车换行）";
    }

    function syncUi() {
        const showConsent = state.stage === "consent_pending";
        const showReview = state.stage === "review" || state.stage === "done";

        els.consentStrip.classList.toggle("visible", showConsent);
        els.reviewActions.classList.toggle("visible", showReview);

        renderStageRail();
        renderGuide();
        syncHeader();
        setBusy(false);

        if (state.stage === "withdrawn") {
            setStatus("访谈已撤回。当前 token 不再继续提问。你可以开启新访谈。");
        } else if (state.stage === "done") {
            setStatus("已定稿完成。若需再次修改，可在草稿弹窗中继续迭代。");
        } else if (state.stage === "review") {
            setStatus("草稿已生成。请先审阅，再用“继续修改”给出定向指令。");
        } else if (state.stage === "consent_pending") {
            setStatus("请先确认知情同意后再开始访谈。");
        }
    }

    function applyExportStats(payload) {
        const userCount = (payload.messages || []).filter((m) => m.role === "user").length;
        const draftCount = (payload.artifacts || []).filter((a) => a.type === "draft").length;
        els.statsBadge.textContent = `回答 ${userCount} 条 · 草稿 ${draftCount} 版`;

        if (payload.readiness && payload.readiness.stages && payload.readiness.stages[state.stage]) {
            const info = payload.readiness.stages[state.stage];
            if (Array.isArray(info.missing) && info.missing.length && CHAT_STAGES.includes(state.stage)) {
                setStatus(`建议补充：${info.missing.slice(0, 2).join("；")}`);
            } else if (info.ready && CHAT_STAGES.includes(state.stage)) {
                setStatus("当前阶段信息已达标，可继续推进下一个阶段。");
            }
        }
    }

    async function refreshState(fullRefresh = false) {
        if (!state.token) {
            state.stage = "consent_pending";
            els.messages.innerHTML = "";
            appendMessage("assistant", "你好，点击“开启新访谈”，先完成知情同意，再开始访谈。", { animate: false });
            els.statsBadge.textContent = "暂无记录";
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
            syncUi();

            const latestDraft = (data.artifacts || []).find((item) => item.type === "draft");
            if (latestDraft && latestDraft.content) {
                state.lastDraft = latestDraft.content;
                els.draftContent.textContent = state.lastDraft;
            }
        } catch (err) {
            localStorage.removeItem("interview_token");
            state.token = "";
            state.stage = "consent_pending";
            els.messages.innerHTML = "";
            appendMessage("system", "当前访谈 token 不可用，已为你重置会话。", { animate: false });
            syncUi();
            showToast(String(err.message || err), "error");
        }
    }

    function updateStageFromNextPayload(data) {
        state.stage = data.should_advance_stage ? data.suggested_next_stage : data.stage;
        if (Array.isArray(data.missing_requirements) && data.missing_requirements.length) {
            setStatus(`当前阶段仍建议补充：${data.missing_requirements.slice(0, 2).join("；")}`);
        } else if (data.stage_ready) {
            setStatus("当前阶段信息已达标，系统会在后续轮次推进阶段。");
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
            showToast("已创建新访谈会话", "success");
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
            state.stage = data.stage || (agreed ? "daily" : "withdrawn");
            await refreshState(true);
            showToast(agreed ? "已同意并进入访谈" : "已记录为不同意参与", agreed ? "success" : "");
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

        appendMessage("user", content);
        const typing = appendMessage("assistant", "正在生成下一问", { typing: true });

        try {
            await api("/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: state.token, content })
            });

            const data = await api(`/next?token=${encodeURIComponent(state.token)}`, { method: "POST" });
            typing.wrap.remove();
            appendMessage("assistant", (data.questions || []).join("\n") || "我再换个方式问。");

            if (data.rights_notice) {
                appendMessage("system", data.rights_notice);
            }

            updateStageFromNextPayload(data);
            syncUi();
        } catch (err) {
            typing.wrap.remove();
            appendMessage("system", String(err.message || err));
        } finally {
            setBusy(false);
        }
    }

    async function skipQuestion() {
        if (state.isBusy || !state.token || !CHAT_STAGES.includes(state.stage)) return;

        setBusy(true);
        const typing = appendMessage("assistant", "正在生成替代提问", { typing: true });

        try {
            const data = await api("/skip", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: state.token, reason: "" })
            });
            typing.wrap.remove();
            appendMessage("assistant", (data.questions || []).join("\n") || "我们继续。");
            if (data.rights_notice) appendMessage("system", data.rights_notice);
            updateStageFromNextPayload(data);
            syncUi();
        } catch (err) {
            typing.wrap.remove();
            appendMessage("system", String(err.message || err));
        } finally {
            setBusy(false);
        }
    }

    async function withdrawInterview() {
        if (state.isBusy || !state.token) return;
        if (!confirm("确认撤回当前访谈？撤回后该会话不再继续提问。")) return;

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

    function openAltModal() {
        if (!state.token || state.isBusy) return;
        els.altModal.classList.add("visible");
    }

    function closeAltModal() {
        els.altModal.classList.remove("visible");
    }

    async function submitAlternative() {
        if (!state.token || state.isBusy) return;

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

            showToast("替代提交已记录", "success");
            await refreshState(true);
        } catch (err) {
            showToast(String(err.message || err), "error");
        } finally {
            setBusy(false);
        }
    }

    async function finalizeInterview(force = false) {
        if (!state.token || state.isBusy) return;

        if (!(state.stage === "wrapup" || state.stage === "review")) {
            showToast("当前阶段不可生成草稿，请先完成访谈", "error");
            return;
        }

        setBusy(true);
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
            showToast("草稿已生成", "success");
        } catch (err) {
            const message = String(err.message || err);
            if (!force && message.includes("missing_requirements")) {
                if (confirm(`${message}\n\n是否忽略门禁直接生成？`)) {
                    setBusy(false);
                    els.finalizeBtn.textContent = "生成草稿";
                    return finalizeInterview(true);
                }
            }
            showToast(message, "error");
        } finally {
            els.finalizeBtn.textContent = "生成草稿";
            setBusy(false);
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
        }, 120);
    }

    async function reviseDraft() {
        if (!state.token || state.isBusy) return;

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
            showToast("草稿已更新", "success");
            await refreshState();
        } catch (err) {
            showToast(String(err.message || err), "error");
        } finally {
            setBusy(false);
        }
    }

    async function approveFinal() {
        if (!state.token || state.isBusy) return;
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
            showToast("已确认定稿", "success");
        } catch (err) {
            showToast(String(err.message || err), "error");
        } finally {
            setBusy(false);
        }
    }

    function onBackdropClose(event, modalId) {
        if (event.target.id !== modalId) return;
        if (modalId === "altModal") closeAltModal();
        if (modalId === "draftModal") closeDraftModal();
    }

    document.addEventListener("click", (event) => {
        const chip = event.target.closest(".quick-chip");
        if (chip) {
            const text = chip.dataset.chip || chip.textContent;
            appendToInput(text);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAltModal();
            closeDraftModal();
        }
    });

    (async function bootstrap() {
        applyTheme(state.theme);
        syncUi();
        await refreshState(true);
    })();
