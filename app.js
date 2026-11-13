// 直接雙擊 HTML 時沒有後端 API，自動切換到本機 FastAPI 網站。
if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8000/");
}

const API_BASE_URL = (window.APP_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const $ = (id) => document.getElementById(id);
const chatBox = $("chatBox"), chatWindow = $("chatWindow"), chatForm = $("chatForm");
const userInput = $("userInput"), sendBtn = $("sendBtn"), statsModal = $("statsModal");
const statsBody = $("statsBody"), overlay = $("modalOverlay"), topicContainer = $("topicContainer");

function appendMessage(role, text, sources = []) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "你" : "AI";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const paragraph = document.createElement("p");
  paragraph.className = "answer-text";
  paragraph.textContent = text;
  bubble.appendChild(paragraph);
  if (role === "agent" && sources.length) {
    const sourceBox = document.createElement("div");
    sourceBox.className = "answer-sources";
    const label = document.createElement("span");
    label.textContent = "官方來源：";
    sourceBox.appendChild(label);
    sources.forEach((source) => {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.title;
      sourceBox.appendChild(link);
    });
    bubble.appendChild(sourceBox);
  }
  message.append(avatar, bubble);
  chatBox.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return message;
}

function appendLoading() {
  const message = document.createElement("div");
  message.className = "message agent";
  message.innerHTML = '<div class="avatar">AI</div><div class="bubble loading-bubble"><span>正在思考</span><span class="typing-dots">•••</span></div>';
  chatBox.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return message;
}

function setSending(sending) {
  sendBtn.disabled = sending;
  userInput.disabled = sending;
  sendBtn.textContent = sending ? "回答中…" : "送出";
}

async function sendMessage(messageText) {
  const text = (messageText || userInput.value).trim();
  if (!text || sendBtn.disabled) return;
  appendMessage("user", text);
  userInput.value = "";
  userInput.style.height = "auto";
  setSending(true);
  const loading = appendLoading();
  try {
    const response = await fetch(apiUrl("/api/chat"), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({message: text})});
    const data = await response.json().catch(() => ({}));
    loading.remove();
    if (!response.ok) throw new Error(data.detail || "伺服器暫時無法回答");
    appendMessage("agent", data.answer, data.sources || []);
  } catch (error) {
    loading.remove();
    appendMessage("agent", `發生錯誤：${error.message}`);
  } finally {
    setSending(false);
    userInput.focus();
  }
}

async function checkHealth() {
  try {
    const response = await fetch(apiUrl("/api/health"));
    const data = await response.json();
    const ready = data.ollama === "ready";
    $("serviceDot").classList.toggle("offline", !ready);
    $("serviceText").textContent = ready ? `模型已就緒：${data.model}` : "網頁已就緒，尚未偵測到 Ollama 模型";
  } catch {
    $("serviceDot").classList.add("offline");
    $("serviceText").textContent = "後端服務尚未連線";
  }
}

function escapeHtml(value) { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }

async function openStats() {
  statsModal.classList.remove("hidden"); overlay.classList.remove("hidden");
  statsBody.innerHTML = '<p class="loading-text">載入中…</p>';
  try {
    const response = await fetch(apiUrl("/api/stats"));
    if (!response.ok) throw new Error("無法讀取統計資料");
    const data = await response.json();
    const rows = data.recent_questions.length ? data.recent_questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>尚無紀錄</li>";
    statsBody.innerHTML = `<div class="stat-grid"><div class="stat-card"><strong>${data.today_count}</strong><span>今日提問</span></div><div class="stat-card"><strong>${data.total_count}</strong><span>累計提問</span></div><div class="stat-card"><strong>${data.official_sources}</strong><span>官方資料來源</span></div><div class="stat-card"><strong>${data.knowledge_chunks}</strong><span>知識段落</span></div></div><h3 class="recent-title">最近的問題</h3><ol class="recent-list">${rows}</ol>`;
  } catch (error) { statsBody.innerHTML = `<p class="loading-text">${escapeHtml(error.message)}</p>`; }
}

function closeStatsModal() { statsModal.classList.add("hidden"); overlay.classList.add("hidden"); }
chatForm.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(); });
userInput.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); chatForm.requestSubmit(); } });
userInput.addEventListener("input", () => { userInput.style.height = "auto"; userInput.style.height = `${Math.min(userInput.scrollHeight, 140)}px`; });
document.querySelectorAll(".topic-btn").forEach((button) => button.addEventListener("click", () => sendMessage(button.textContent)));
$("toggleTopicBtn").addEventListener("click", () => { const open = topicContainer.classList.toggle("open"); $("toggleTopicBtn").textContent = open ? "常見問題 −" : "常見問題 ＋"; $("toggleTopicBtn").setAttribute("aria-expanded", String(open)); });
$("statsBtn").addEventListener("click", openStats); $("closeStats").addEventListener("click", closeStatsModal); overlay.addEventListener("click", closeStatsModal);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeStatsModal(); });
checkHealth(); userInput.focus();
