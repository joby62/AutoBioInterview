const state = {
  user: null,
  projects: [],
  currentProject: null,
  currentSession: null,
};

const DEFAULT_PROJECT_TITLE = "中国传媒大学数字学习自传访谈";
const DEFAULT_INVITATION_TEXT = [
  "【数字学习自传访谈邀请函】",
  "您好！我们正在开展“中国传媒大学数字学习自传”研究，关注学习者在数字平台中的真实学习经历。",
  "",
  "访谈将围绕以下内容展开：",
  "1. 日常学习场景（平台、时间、内容、时长）；",
  "2. 学习方式的变化节点与原因；",
  "3. 学习过程中的体验、情绪、困难与应对；",
  "4. 数字学习对学业、工作、生活与自我认同的影响。",
  "",
  "参与说明：",
  "- 访谈约 20-35 分钟；",
  "- 你可随时跳过问题、暂停或退出；",
  "- 内容仅用于学术研究，发布前会进行匿名化处理。",
  "",
  "感谢你的参与与分享。"
].join("\\n");

const els = {
  userEmail: document.getElementById("userEmail"),
  logoutBtn: document.getElementById("logoutBtn"),
  authCard: document.getElementById("authCard"),
  workspace: document.getElementById("workspace"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  loginBtn: document.getElementById("loginBtn"),
  registerBtn: document.getElementById("registerBtn"),
  authStatus: document.getElementById("authStatus"),
  projectTitle: document.getElementById("projectTitle"),
  invitationText: document.getElementById("invitationText"),
  createProjectBtn: document.getElementById("createProjectBtn"),
  projectStatus: document.getElementById("projectStatus"),
  quickParticipantBtn: document.getElementById("quickParticipantBtn"),
  quickLinkStatus: document.getElementById("quickLinkStatus"),
  projectList: document.getElementById("projectList"),
  projectDetailPanel: document.getElementById("projectDetailPanel"),
  projectDetailEmpty: document.getElementById("projectDetailEmpty"),
  projectDetail: document.getElementById("projectDetail"),
  detailTitle: document.getElementById("detailTitle"),
  inviteLink: document.getElementById("inviteLink"),
  templateOpening: document.getElementById("templateOpening"),
  sessionList: document.getElementById("sessionList"),
  sessionPanel: document.getElementById("sessionPanel"),
  sessionEmpty: document.getElementById("sessionEmpty"),
  sessionDetail: document.getElementById("sessionDetail"),
  sessionStage: document.getElementById("sessionStage"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportTxtBtn: document.getElementById("exportTxtBtn"),
  sessionSummary: document.getElementById("sessionSummary"),
  transcript: document.getElementById("transcript"),
};

function setStatus(el, text, isError = false) {
  el.textContent = text || "";
  el.style.color = isError ? "#b42318" : "#1f5f9f";
}

function hydrateProjectDefaults() {
  if (!els.projectTitle.value.trim()) {
    els.projectTitle.value = DEFAULT_PROJECT_TITLE;
  }
  if (!els.invitationText.value.trim()) {
    els.invitationText.value = DEFAULT_INVITATION_TEXT;
  }
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    if (typeof detail === "string") throw new Error(detail);
    throw new Error(JSON.stringify(detail || data));
  }
  return data;
}

function renderAuthState() {
  const loggedIn = !!state.user;
  els.authCard.classList.toggle("hidden", loggedIn);
  els.workspace.classList.toggle("hidden", !loggedIn);
  els.logoutBtn.classList.toggle("hidden", !loggedIn);
  els.userEmail.textContent = loggedIn ? state.user.email : "未登录";
}

function stageText(stage) {
  const map = {
    consent_pending: "待同意",
    daily: "日常",
    evolution: "变化",
    experience: "体验",
    difficulty: "困难",
    impact: "影响",
    wrapup: "补充",
    review: "审阅",
    done: "完成",
    withdrawn: "已终止",
  };
  return map[stage] || stage;
}

function renderProjects() {
  if (!state.projects.length) {
    els.projectList.innerHTML = '<div class="empty">暂无项目，先创建一个。</div>';
    return;
  }

  els.projectList.innerHTML = state.projects
    .map((p) => {
      const active = state.currentProject && state.currentProject.id === p.id ? "active" : "";
      return `
        <div class="project-item ${active}" data-id="${p.id}">
          <strong>${p.title}</strong>
          <div class="sub">链接码：${p.invite_code || "-"} · 会话 ${p.sessions_count || 0}</div>
        </div>
      `;
    })
    .join("");
}

function renderQuickLinks() {
  const p = state.currentProject;
  if (!p || !p.invite_code) {
    els.quickParticipantBtn.href = "/participant-direct";
    els.quickLinkStatus.textContent = "当前未选中项目，默认打开最新项目受访链接。";
    return;
  }
  const url = `${window.location.origin}/participant/${p.invite_code}`;
  els.quickParticipantBtn.href = url;
  els.quickLinkStatus.textContent = `当前项目受访链接：${url}`;
}

function renderProjectDetail() {
  const p = state.currentProject;
  const has = !!p;
  els.projectDetailEmpty.classList.toggle("hidden", has);
  els.projectDetail.classList.toggle("hidden", !has);

  if (!p) {
    els.sessionList.innerHTML = "";
    state.currentSession = null;
    renderSessionDetail();
    renderQuickLinks();
    return;
  }

  els.detailTitle.textContent = p.title;
  const url = `${window.location.origin}/participant/${p.invite_code}`;
  els.inviteLink.textContent = url;
  els.inviteLink.href = url;
  els.templateOpening.textContent = p.template?.opening_script || "";

  const sessions = Array.isArray(p.sessions) ? p.sessions : [];
  if (!sessions.length) {
    els.sessionList.innerHTML = '<div class="empty">暂无受访者进入</div>';
    state.currentSession = null;
    renderSessionDetail();
    renderQuickLinks();
    return;
  }

  els.sessionList.innerHTML = sessions
    .map((s) => {
      const active = state.currentSession && state.currentSession.id === s.id ? "active" : "";
      return `
        <div class="session-item ${active}" data-id="${s.id}">
          <strong>${s.id.slice(0, 8)}</strong>
          <div class="sub">阶段：${stageText(s.stage)} · 消息 ${s.message_count || 0}</div>
          <div class="sub">更新时间：${(s.updated_at || "").replace("T", " ").slice(0, 19)}</div>
        </div>
      `;
    })
    .join("");
  renderQuickLinks();
}

function renderSessionDetail() {
  const s = state.currentSession;
  const has = !!s;
  els.sessionEmpty.classList.toggle("hidden", has);
  els.sessionDetail.classList.toggle("hidden", !has);
  if (!s) return;

  els.sessionStage.textContent = `会话 ${s.id.slice(0, 8)} · 阶段 ${stageText(s.stage)}`;
  els.sessionSummary.textContent = s.summary_text || "尚未生成总结";

  const msgs = Array.isArray(s.messages) ? s.messages : [];
  if (!msgs.length) {
    els.transcript.innerHTML = '<div class="empty">暂无消息</div>';
    return;
  }

  els.transcript.innerHTML = msgs
    .map((m) => {
      const role = m.role || "assistant";
      const content = (m.content || "").replace(/</g, "&lt;");
      const ts = (m.created_at || "").replace("T", " ").slice(0, 19);
      return `
        <article class="msg ${role}">
          <div class="role">${role} · ${ts}</div>
          <div>${content}</div>
        </article>
      `;
    })
    .join("");
}

async function refreshProjects() {
  const res = await api("/api/researcher/projects");
  state.projects = res.projects || [];
  renderProjects();
  if (!state.currentProject && state.projects.length) {
    await loadProject(state.projects[0].id);
  } else {
    renderQuickLinks();
  }
}

async function loadProject(projectId) {
  const res = await api(`/api/researcher/projects/${encodeURIComponent(projectId)}`);
  state.currentProject = res.project;
  renderProjects();
  renderProjectDetail();
}

async function loadSession(sessionId) {
  const res = await api(`/api/researcher/sessions/${encodeURIComponent(sessionId)}`);
  state.currentSession = res.session;
  renderProjectDetail();
  renderSessionDetail();
}

async function login() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    setStatus(els.authStatus, "请填写邮箱和密码", true);
    return;
  }
  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.user = res.user;
    renderAuthState();
    setStatus(els.authStatus, "登录成功");
    await refreshProjects();
  } catch (err) {
    setStatus(els.authStatus, String(err.message || err), true);
  }
}

async function register() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    setStatus(els.authStatus, "请填写邮箱和密码", true);
    return;
  }
  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setStatus(els.authStatus, "注册成功，请点击登录");
  } catch (err) {
    setStatus(els.authStatus, String(err.message || err), true);
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
  state.user = null;
  state.projects = [];
  state.currentProject = null;
  state.currentSession = null;
  renderAuthState();
  renderProjects();
  renderProjectDetail();
  renderSessionDetail();
}

async function createProject() {
  const title = els.projectTitle.value.trim();
  const invitationText = els.invitationText.value.trim();
  if (!invitationText) {
    setStatus(els.projectStatus, "请先粘贴邀请函内容", true);
    return;
  }

  els.createProjectBtn.disabled = true;
  setStatus(els.projectStatus, "正在生成模板并创建项目...");
  try {
    const res = await api("/api/researcher/projects", {
      method: "POST",
      body: JSON.stringify({ title, invitation_text: invitationText }),
    });
    setStatus(els.projectStatus, "项目创建成功");
    els.projectTitle.value = DEFAULT_PROJECT_TITLE;
    await refreshProjects();
    await loadProject(res.project.id);
  } catch (err) {
    setStatus(els.projectStatus, String(err.message || err), true);
  } finally {
    els.createProjectBtn.disabled = false;
  }
}

function bindEvents() {
  els.loginBtn.addEventListener("click", login);
  els.registerBtn.addEventListener("click", register);
  els.logoutBtn.addEventListener("click", logout);
  els.createProjectBtn.addEventListener("click", createProject);

  els.projectList.addEventListener("click", (event) => {
    const item = event.target.closest(".project-item");
    if (!item) return;
    loadProject(item.dataset.id);
  });

  els.sessionList.addEventListener("click", (event) => {
    const item = event.target.closest(".session-item");
    if (!item) return;
    loadSession(item.dataset.id);
  });

  els.exportJsonBtn.addEventListener("click", () => {
    if (!state.currentSession) return;
    window.open(`/api/researcher/sessions/${encodeURIComponent(state.currentSession.id)}/export?fmt=json`, "_blank");
  });

  els.exportTxtBtn.addEventListener("click", () => {
    if (!state.currentSession) return;
    window.open(`/api/researcher/sessions/${encodeURIComponent(state.currentSession.id)}/export?fmt=txt`, "_blank");
  });
}

async function bootstrap() {
  hydrateProjectDefaults();
  bindEvents();
  renderAuthState();
  renderProjects();
  renderProjectDetail();
  renderSessionDetail();
  renderQuickLinks();

  try {
    const me = await api("/api/auth/me");
    state.user = me.user;
    renderAuthState();
    await refreshProjects();
  } catch {
    state.user = null;
    renderAuthState();
  }
}

bootstrap();
