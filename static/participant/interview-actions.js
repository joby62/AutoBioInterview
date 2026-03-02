async function loadModelConfig() {
    try {
        const data = await api("/model-config");
        state.availableModels = Array.isArray(data.available_models) && data.available_models.length
            ? data.available_models
            : [...DEFAULT_MODELS];
        state.defaultModel = data.default_model || state.availableModels[0];
        const speedModels = resolveSpeedModels(state.availableModels, state.defaultModel);
        state.fastModel = speedModels.fastModel;
        state.balancedModel = speedModels.balancedModel;
        state.deepModel = speedModels.deepModel;

        const preferred = normalizeSpeedMode(safeStorageRead(SPEED_PREF_KEY, "fast"));
        const preferredModel = modelBySpeedMode(preferred);
        state.speedMode = preferredModel ? preferred : "fast";
        const targetModel = modelBySpeedMode(state.speedMode);

        state.modelOrch = data.orch_model || targetModel;
        state.modelWrite = data.write_model || state.modelOrch;

        if (state.modelOrch !== targetModel || state.modelWrite !== targetModel) {
            const ok = await updateModelConfig(targetModel, false);
            if (!ok) {
                if (state.modelOrch === state.deepModel) {
                    state.speedMode = "deep";
                } else if (state.modelOrch === state.balancedModel) {
                    state.speedMode = "balanced";
                } else {
                    state.speedMode = "fast";
                }
            }
        }
    } catch {
        state.availableModels = [...DEFAULT_MODELS];
        state.defaultModel = FAST_MODEL_ID;
        const speedModels = resolveSpeedModels(state.availableModels, state.defaultModel);
        state.fastModel = speedModels.fastModel;
        state.balancedModel = speedModels.balancedModel;
        state.deepModel = speedModels.deepModel;
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
    const pro = pool.find((m) => /pro/i.test(m));

    let fastModel = mini || defaultModel || pool[0] || FAST_MODEL_ID;
    if (!pool.includes(fastModel)) pool.push(fastModel);
    const balancedModel = lite || "";
    const deepModel = pro || "";
    return { fastModel, balancedModel, deepModel };
}

function renderSpeedControl() {
    const modes = [
        { key: "fast", btn: els.speedFastBtn },
        { key: "balanced", btn: els.speedBalancedBtn },
        { key: "deep", btn: els.speedDeepBtn }
    ];

    const availableByMode = {
        fast: Boolean(state.fastModel),
        balanced: Boolean(state.balancedModel),
        deep: Boolean(state.deepModel)
    };

    for (const item of modes) {
        item.btn.classList.toggle("active", state.speedMode === item.key);
        item.btn.setAttribute("aria-pressed", String(state.speedMode === item.key));
        item.btn.disabled = !availableByMode[item.key];
    }

    if (state.isBusy) {
        els.speedHint.textContent = "助手思考中，可切换快速/中庸/深度（下一轮生效）";
    } else {
        els.speedHint.textContent = `当前：${speedModeLabel(state.speedMode)}（${modelBySpeedMode(state.speedMode)}）`;
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
            showToast(`已切换为${speedModeLabel(state.speedMode)}思考`, "success");
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
    if (!["fast", "balanced", "deep"].includes(mode)) return;
    const targetModel = modelBySpeedMode(mode);
    if (!targetModel) return;
    if (mode === state.speedMode) return;

    const prev = state.speedMode;
    state.speedMode = mode;
    renderSpeedControl();

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
        state.estimatedStepMinutes = 5;
        state.stageReady = false;
        state.stageMissing = [];
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
        updatePaceEstimate(data);
        applyExportStats(data);

        const latestDraft = (data.artifacts || []).find((a) => a.type === "draft");
        if (latestDraft && latestDraft.content) {
            state.lastDraft = latestDraft.content;
            els.draftContent.textContent = state.lastDraft;
        }

        syncUi();
    } catch (err) {
        safeStorageRemove(TOKEN_KEY);
        safeCookieRemove(COOKIE_TOKEN_KEY);
        safeCookieRemove(COOKIE_STAGE_KEY);
        safeCookieRemove(COOKIE_CONSENT_KEY);
        state.token = "";
        state.stage = "consent_pending";
        state.stageReady = false;
        state.stageMissing = [];
        els.messages.innerHTML = "";
        appendMessage("system", "当前 token 不可用，已重置会话。", { animate: false });
        syncUi();
        showToast(String(err.message || err), "error");
    }
}

async function overlayAgreeAndStart() {
    if (state.isBusy) return;

    setBusy(true);
    try {
        if (!state.token) {
            const created = await api("/interviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invite_code: parseInviteCodeFromPath() })
            });
            state.token = created.token;
            state.stage = created.stage;
            state.estimatedStepMinutes = 5;
            persistSessionSnapshot();
        }

        if (state.stage === "consent_pending") {
            const res = await api("/consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: state.token, agreed: true })
            });
            const prev = state.stage;
            state.stage = res.stage || "daily";
            state.stageReady = false;
            state.stageMissing = [];
            if (detectStageAdvance(prev, state.stage)) {
                spawnConfetti(0.9);
                showProgressPanel(adaptivePanelHideDelay("stage_complete"), "stage_complete");
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

async function participantLogin() {
    if (state.isBusy) return;
    const token = String(els.participantTokenInput.value || "").trim();
    if (!token) {
        showToast("请输入受访者会话码", "");
        return;
    }

    setBusy(true);
    try {
        const probe = await api(`/export?token=${encodeURIComponent(token)}`);
        state.token = token;
        state.stage = probe?.interview?.stage || "consent_pending";
        persistSessionSnapshot();
        els.participantTokenInput.value = "";
        await refreshState(true);
        showToast("已恢复到该受访者会话", "success");
    } catch (err) {
        showToast(String(err.message || err), "error");
    } finally {
        setBusy(false);
    }
}

async function participantLogout() {
    if (state.isBusy) return;
    setBusy(true);
    try {
        state.token = "";
        state.stage = "consent_pending";
        state.stageReady = false;
        state.stageMissing = [];
        state.lastDraft = "";
        persistSessionSnapshot();
        els.participantTokenInput.value = "";
        await refreshState(true);
        showToast("已退出当前受访者会话", "success");
    } finally {
        setBusy(false);
    }
}

function openAdminShell() {
    els.adminShellModal.classList.add("visible");
}

function closeAdminShell() {
    els.adminShellModal.classList.remove("visible");
}

async function advanceStageManually() {
    if (state.isBusy || !state.token || !CHAT_STAGES.includes(state.stage)) return;
    if (!state.stageReady) {
        showToast("当前阶段还未达标，建议先补充本阶段关键信息。", "");
        return;
    }

    setBusy(true);
    try {
        const prevStage = state.stage;
        const data = await api("/advance-stage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token })
        });

        state.stage = data.stage || prevStage;
        state.stageReady = false;
        state.stageMissing = [];

        const nextText = Array.isArray(data.questions) && data.questions.length
            ? data.questions.join("\n")
            : "已进入下一阶段，我们继续。";
        await appendAssistantTypewriter(nextText);

        if (detectStageAdvance(prevStage, state.stage)) {
            spawnConfetti(1);
            showProgressPanel(adaptivePanelHideDelay("stage_complete"), "stage_complete");
            showToast(`已进入${STAGE_NAMES[state.stage]}阶段`, "success");
        }

        await refreshState();
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
        state.stageReady = false;
        state.stageMissing = Array.isArray(data.missing_requirements) ? data.missing_requirements : [];
        if (detectStageAdvance(prevStage, state.stage)) {
            spawnConfetti(1);
            showProgressPanel(adaptivePanelHideDelay("stage_complete"), "stage_complete");
            showToast(`进入${STAGE_NAMES[state.stage]}阶段`, "success");
        }

        if (Array.isArray(data.missing_requirements) && data.missing_requirements.length) {
            setStatus(`当前阶段建议补充：${data.missing_requirements.slice(0, 2).join("；")}`);
        } else if (data.stage_ready) {
            setStatus("当前阶段信息已达标，继续聊可推进下一阶段");
        }

        syncUi();
        await refreshState();
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
        state.stageReady = false;
        state.stageMissing = Array.isArray(data.missing_requirements) ? data.missing_requirements : [];
        if (detectStageAdvance(prevStage, state.stage)) {
            spawnConfetti(0.9);
            showProgressPanel(adaptivePanelHideDelay("stage_complete"), "stage_complete");
        }

        syncUi();
        await refreshState();
    } catch (err) {
        typing.remove();
        appendMessage("system", String(err.message || err));
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
    els.participantLoginBtn.addEventListener("click", participantLogin);
    els.participantLogoutBtn.addEventListener("click", participantLogout);
    els.participantTokenInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            participantLogin();
        }
    });
    els.adminEntryBtn.addEventListener("click", openAdminShell);
    els.adminShellCloseBtn.addEventListener("click", closeAdminShell);
    els.adminShellModal.addEventListener("click", (event) => {
        if (event.target === els.adminShellModal) closeAdminShell();
    });

    els.speedFastBtn.addEventListener("click", () => {
        switchSpeed("fast");
    });
    els.speedBalancedBtn.addEventListener("click", () => {
        switchSpeed("balanced");
    });
    els.speedDeepBtn.addEventListener("click", () => {
        switchSpeed("deep");
    });

    els.overlayAgreeBtn.addEventListener("click", overlayAgreeAndStart);
    els.overlayDeclineBtn.addEventListener("click", overlayDecline);
    els.introConfirmBtn.addEventListener("click", confirmIntroAndClose);

    els.sendBtn.addEventListener("click", sendMessage);
    els.advanceStageBtn.addEventListener("click", advanceStageManually);
    els.skipBtn.addEventListener("click", skipQuestion);
    els.finalizeBtn.addEventListener("click", () => finalizeInterview());

    els.viewDraftBtn.addEventListener("click", openDraftModal);
    els.reviseDraftTriggerBtn.addEventListener("click", focusRevisionInput);
    els.approveFinalBtn.addEventListener("click", approveFinal);

    els.shuffleSparkBtn.addEventListener("click", shuffleSparks);

    els.draftCloseBtn.addEventListener("click", closeDraftModal);
    els.reviseBtn.addEventListener("click", reviseDraft);
    els.approveBtn.addEventListener("click", approveFinal);
    els.draftModal.addEventListener("click", (event) => {
        if (event.target === els.draftModal) closeDraftModal();
    });

    els.progressFab.addEventListener("click", toggleProgressPanel);
    els.progressFab.addEventListener("pointerdown", startFabDrag);
    els.progressFab.addEventListener("pointermove", onFabDragMove);
    els.progressFab.addEventListener("pointerup", endFabDrag);
    els.progressFab.addEventListener("pointercancel", endFabDrag);

    els.progressFab.addEventListener("mouseenter", onProgressHoverEnter);
    els.progressFab.addEventListener("mouseleave", onProgressHoverLeave);
    els.progressPanel.addEventListener("mouseenter", onProgressHoverEnter);
    els.progressPanel.addEventListener("mouseleave", onProgressHoverLeave);

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
            closeDraftModal();
            closeAdminShell();
            hideProgressPanel();
        }
    });

    window.addEventListener("resize", () => {
        ensureCanvasSize();
        applyFabPosition();
    });
}

async function bootstrap() {
    try {
        ensureCanvasSize();
        attachEvents();
        autosizeTextarea();
        updateWordCounter();
        loadFabPosition();
        applyFabPosition();
        hideProgressPanel();

        await loadModelConfig();
        syncUi();
        await refreshState(true);
    } catch (err) {
        console.error("Bootstrap failed:", err);
        setStatus("页面初始化失败，请刷新重试");
        showToast(`页面初始化失败：${String(err.message || err)}`, "error");
    }
}
