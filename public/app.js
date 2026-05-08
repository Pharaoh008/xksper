const storeKey = "agentops-studio:v1";

const defaults = {
  settings: {
    apiKey: "",
    baseUrl: "https://wcnb.ai"
  },
  agent: {
    name: "Vercel Agent",
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.4,
    systemPrompt: "你是一个可靠、主动、会说明推理边界的业务智能体。你会优先使用已提供的知识库、Skill 和 MCP 上下文，回答时给出可执行步骤。"
  },
  knowledge: [
    {
      title: "项目边界",
      content: "这个网站使用 PHP Serverless API 作为模型调用层，前端用于配置 Agent、知识库、MCP 与 Skill。"
    }
  ],
  mcp: [
    {
      name: "HTTP MCP 示例",
      endpoint: "",
      description: "可填写一个 HTTP MCP 网关地址，Harness 会把当前任务发给它并纳入上下文。"
    }
  ],
  skills: [
    {
      name: "结构化交付",
      prompt: "回答必须先给结论，再给步骤，最后列出风险和下一步。"
    }
  ],
  messages: []
};

let state = loadState();

const views = document.querySelectorAll(".view");
const tabs = document.querySelectorAll(".tab");
const transcript = document.querySelector("#transcript");
const traceList = document.querySelector("#trace-list");
const reasoningList = document.querySelector("#reasoning-list");
const form = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message");
const runButton = document.querySelector("#run-button");
const threadId = crypto.randomUUID ? crypto.randomUUID() : `thread-${Date.now()}`;

function loadState() {
  try {
    return structuredClone({
      ...defaults,
      ...JSON.parse(localStorage.getItem(storeKey) || "{}")
    });
  } catch {
    return structuredClone(defaults);
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
  updateStatus();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bindForm() {
  document.querySelector("#api-key").value = state.settings.apiKey;
  document.querySelector("#base-url").value = state.settings.baseUrl;
  document.querySelector("#agent-name").value = state.agent.name;
  document.querySelector("#provider").value = state.agent.provider;
  document.querySelector("#model").value = state.agent.model;
  document.querySelector("#temperature").value = state.agent.temperature;
  document.querySelector("#system-prompt").value = state.agent.systemPrompt;
}

function readForm() {
  state.settings.apiKey = document.querySelector("#api-key").value.trim();
  state.settings.baseUrl = document.querySelector("#base-url").value.trim() || "https://wcnb.ai";
  state.agent.name = document.querySelector("#agent-name").value.trim() || "Untitled Agent";
  state.agent.provider = document.querySelector("#provider").value;
  state.agent.model = document.querySelector("#model").value.trim();
  state.agent.temperature = Number(document.querySelector("#temperature").value || 0.4);
  state.agent.systemPrompt = document.querySelector("#system-prompt").value.trim();
  saveState();
}

function updateStatus() {
  document.querySelector("#status-model").textContent = state.agent.provider.toUpperCase();
  document.querySelector("#status-kb").textContent = state.knowledge.length;
  document.querySelector("#status-skills").textContent = state.skills.length;
}

function renderMessages() {
  if (!state.messages.length) {
    transcript.innerHTML = `
      <div class="empty-state">
        <div class="empty-mark">RUN</div>
        <p>输入任务即可运行智能体。生产环境默认使用 Vercel 环境变量中的 wcnb.ai API Key。</p>
      </div>
    `;
    return;
  }

  transcript.innerHTML = state.messages.map((message) => `
    <article class="bubble ${message.role}">
      <span>${message.role === "user" ? "你" : state.agent.name}</span>
      <p>${escapeHtml(message.content)}</p>
    </article>
  `).join("");
  transcript.scrollTop = transcript.scrollHeight;
}

function renderTrace(steps = []) {
  traceList.innerHTML = (steps.length ? steps : ["等待输入"]).map((step) => {
    if (typeof step === "string") return `<li>${escapeHtml(step)}</li>`;

    const duration = Number.isFinite(step.durationMs) ? ` · ${step.durationMs}ms` : "";
    const detail = step.detail ? `<small>${escapeHtml(step.detail)}</small>` : "";
    const output = step.output
      ? `<small>checkpoint: K${step.output.knowledge || 0} / S${step.output.skills || 0} / MCP${step.output.mcp || 0}</small>`
      : "";

    return `
      <li>
        <strong>${escapeHtml(step.node)} ${escapeHtml(step.status || "")}${duration}</strong>
        ${detail}
        ${output}
      </li>
    `;
  }).join("");
}

function renderReasoning(items = []) {
  reasoningList.innerHTML = (items.length ? items : [
    { title: "等待任务", summary: "运行后会展示可审计的推理摘要、上下文选择、MCP/Skill 注入和节点耗时。" }
  ]).map((item) => `
    <article>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.summary)}</p>
    </article>
  `).join("");
}

function renderList(kind) {
  const list = document.querySelector(`#${kind === "skills" ? "skill" : kind}-list`);
  const rows = state[kind];

  list.innerHTML = rows.map((item, index) => {
    const title = item.title || item.name || `条目 ${index + 1}`;
    const body = item.content || item.description || item.prompt || item.endpoint || "";
    return `
      <article class="item">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(body)}</p>
        </div>
        <button type="button" data-remove="${kind}" data-index="${index}" title="删除">×</button>
      </article>
    `;
  }).join("");
}

function renderAll() {
  bindForm();
  updateStatus();
  renderMessages();
  renderTrace();
  renderReasoning();
  renderList("knowledge");
  renderList("mcp");
  renderList("skills");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.view;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    views.forEach((view) => view.classList.toggle("active", view.id === `view-${target}`));
  });
});

document.querySelector("#save-agent").addEventListener("click", () => {
  readForm();
  renderAll();
});

document.querySelector("#save-settings").addEventListener("click", () => {
  readForm();
  renderAll();
});

document.querySelector("#clear-chat").addEventListener("click", () => {
  state.messages = [];
  saveState();
  renderMessages();
  renderTrace();
  renderReasoning();
});

document.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove]");

  if (remove) {
    state[remove.dataset.remove].splice(Number(remove.dataset.index), 1);
    saveState();
    renderAll();
  }
});

document.querySelectorAll("[data-create]").forEach((createForm) => {
  createForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const kind = createForm.dataset.create;
    const data = new FormData(createForm);

    if (kind === "knowledge") {
      state.knowledge.push({
        title: String(data.get("title") || "").trim(),
        content: String(data.get("content") || "").trim()
      });
    }

    if (kind === "mcp") {
      const endpoint = String(data.get("endpoint") || "").trim();
      state.mcp.push({
        name: String(data.get("name") || "").trim(),
        endpoint,
        description: String(data.get("description") || endpoint || "待配置").trim()
      });
    }

    if (kind === "skills") {
      state.skills.push({
        name: String(data.get("name") || "").trim(),
        prompt: String(data.get("prompt") || "").trim()
      });
    }

    createForm.reset();
    saveState();
    renderAll();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  readForm();

  const content = messageInput.value.trim();
  if (!content) return;

  state.messages.push({ role: "user", content });
  messageInput.value = "";
  renderMessages();
  renderTrace([{ node: "client", status: "发送任务" }]);
  renderReasoning([{ title: "请求已发送", summary: "正在进入 Harness 状态图，准备检索知识库、注入 Skill 并调用模型。" }]);
  runButton.disabled = true;

  try {
    const response = await fetch("/api/agent.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: state.settings,
        threadId,
        agent: state.agent,
        knowledge: state.knowledge,
        mcp: state.mcp,
        skills: state.skills,
        messages: state.messages
      })
    });
    const payload = await response.json();

    if (!payload.ok) throw new Error(payload.error || "智能体运行失败");

    state.messages.push({ role: "assistant", content: payload.output });
    saveState();
    renderMessages();
    renderTrace(payload.trace || []);
    renderReasoning(payload.reasoning || []);
  } catch (error) {
    state.messages.push({ role: "assistant", content: `运行失败：${error.message}` });
    saveState();
    renderMessages();
    renderTrace([{ node: "error", status: error.message }]);
    renderReasoning([{ title: "运行失败", summary: error.message }]);
  } finally {
    runButton.disabled = false;
  }
});

renderAll();
