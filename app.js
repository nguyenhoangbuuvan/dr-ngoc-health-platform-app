const SUPABASE_URL = "https://jadstuosnvomswitnhqn.supabase.co";
const SUPABASE_KEY = "sb_publishable_Em171UQLEd05XA_ny7VFtw_SXNlc6XY";

const state = {
  accessToken: localStorage.getItem("drn_access_token") || "",
  refreshToken: localStorage.getItem("drn_refresh_token") || "",
  email: localStorage.getItem("drn_email") || "",
  selectedCustomerCode: "",
  selectedProfile: null,
  activeView: "overview",
};

const $ = (id) => document.getElementById(id);
const els = {
  loginPanel: $("loginPanel"), loginForm: $("loginForm"), loginError: $("loginError"),
  emailInput: $("emailInput"), passwordInput: $("passwordInput"), workspace: $("workspace"),
  sessionState: $("sessionState"), signOutButton: $("signOutButton"), connectionStatus: $("connectionStatus"),
  statusLine: $("statusLine"), searchInput: $("searchInput"), searchButton: $("searchButton"),
  resultList: $("resultList"), resultCount: $("resultCount"), profileContent: $("profileContent"), profileStatus: $("profileStatus"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (label) button.textContent = label;
}

function showError(message) {
  els.loginError.textContent = message || "Có lỗi xảy ra.";
  els.loginError.hidden = false;
}

function saveSession(session, email) {
  state.accessToken = session.access_token;
  state.refreshToken = session.refresh_token;
  state.email = email;
  localStorage.setItem("drn_access_token", state.accessToken);
  localStorage.setItem("drn_refresh_token", state.refreshToken);
  localStorage.setItem("drn_email", state.email);
}

function clearSession() {
  state.accessToken = ""; state.refreshToken = ""; state.email = ""; state.selectedCustomerCode = ""; state.selectedProfile = null;
  localStorage.removeItem("drn_access_token"); localStorage.removeItem("drn_refresh_token"); localStorage.removeItem("drn_email");
}

function renderShell() {
  const signedIn = Boolean(state.accessToken);
  els.loginPanel.hidden = signedIn;
  els.workspace.hidden = !signedIn;
  els.signOutButton.hidden = !signedIn;
  els.sessionState.textContent = signedIn ? state.email : "Chưa đăng nhập";
  els.connectionStatus.textContent = signedIn ? "Đã kết nối Supabase" : "Chưa kết nối";
  els.statusLine.textContent = signedIn ? "Nhân viên có thể tra cứu, nhập note, lab và Phiếu khám nhanh." : "Đăng nhập bằng tài khoản nhân viên đã được cấp quyền.";
  document.querySelectorAll(".nav").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === state.activeView));
  if (state.selectedProfile) renderProfile(state.selectedProfile);
}

async function api(path, options = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${state.accessToken || SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || "Đăng nhập thất bại");
  saveSession(payload, email);
}

async function searchCustomers(query) {
  return api("/rest/v1/rpc/api_search_customers", { method: "POST", body: JSON.stringify({ search_text: query, max_results: 50 }) });
}

async function getCustomerProfile(customerRef) {
  return api("/rest/v1/rpc/api_get_customer_profile", { method: "POST", body: JSON.stringify({ customer_ref: customerRef }) });
}

async function getPatientSummary(customerCode) {
  try {
    const rows = await api(`/rest/v1/patient_record_summary?select=*&customer_code=eq.${encodeURIComponent(customerCode)}&limit=1`);
    return rows?.[0] || null;
  } catch (_) { return null; }
}

async function addCustomerNote(customerRef, content, noteType, sensitivityLevel) {
  return api("/rest/v1/rpc/api_add_customer_note", { method: "POST", body: JSON.stringify({ customer_ref: customerRef, content, note_type: noteType, sensitivity_level: sensitivityLevel }) });
}

async function createLabResult(payload) {
  return api("/rest/v1/rpc/api_create_lab_result", { method: "POST", body: JSON.stringify(payload) });
}

async function createVisit(payload) {
  return api("/rest/v1/consultation_visits?select=id,visit_number,visit_date", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
}
async function createVitals(payload) {
  return api("/rest/v1/consultation_vitals?select=id,bmi", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
}
async function createMedication(payload) {
  return api("/rest/v1/consultation_medications?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
}
async function createFollowup(payload) {
  return api("/rest/v1/consultation_followups?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
}

function fmtDate(value) { return value ? new Date(value).toLocaleDateString("vi-VN") : "-"; }
function fmtMoney(value) { return value == null ? "-" : Number(value).toLocaleString("vi-VN") + " VND"; }
function list(items, render, empty = "Chưa có dữ liệu.") { return items?.length ? items.map(render).join("") : `<div class="empty compact">${empty}</div>`; }
function optionalNumber(value) { const s = String(value || "").trim().replace(",", "."); return s === "" || Number.isNaN(Number(s)) ? null : Number(s); }
function optionalInteger(value) { const n = optionalNumber(value); return n == null ? null : Math.round(n); }
function splitList(value) { return String(value || "").split(",").map((x) => x.trim()).filter(Boolean); }
function compact(obj) { return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))); }

function renderResults(results) {
  els.resultCount.textContent = String(results.length);
  els.resultList.innerHTML = results.length ? results.map((item) => `
    <button class="result" type="button" data-code="${escapeHtml(item.customer_code)}">
      <strong>${escapeHtml(item.full_name || "Không tên")}</strong>
      <span>${escapeHtml(item.customer_code)} · ${escapeHtml(item.masked_primary_phone || "-")}</span>
    </button>`).join("") : '<div class="empty">Không có kết quả.</div>';
}

function renderProfile(profile) {
  const customer = profile.customer || {};
  const summary = profile.ehrSummary || null;
  els.profileStatus.textContent = customer.customer_code || "Đang xem";
  const conditions = profile.conditions || [];
  const labs = profile.lab_results || [];
  const notes = profile.notes || [];
  const products = profile.products || [];
  const metrics = profile.recommended_lab_metrics || [];
  const stats = profile.stats || {};
  const active = state.activeView;

  els.profileContent.innerHTML = `
    <section class="hero">
      <div class="avatar">${escapeHtml((customer.full_name || "DN").split(/\s+/).slice(-2).map((x) => x[0]).join("").toUpperCase())}</div>
      <div><div class="eyebrow">${escapeHtml(customer.customer_code || "-")}</div><h2>${escapeHtml(customer.full_name || "Không tên")}</h2><p>${escapeHtml(customer.customer_uuid || "")}</p></div>
      <div class="hero-stats"><span>${fmtMoney(stats.total_spent_vnd)}</span><small>Tổng chi tiêu</small></div>
    </section>
    <section class="cards">
      <article><strong>${escapeHtml(summary?.ehr_status || "Đang cập nhật")}</strong><span>Trạng thái EHR</span></article>
      <article><strong>${conditions.length}</strong><span>Bệnh lý đã xác nhận</span></article>
      <article><strong>${labs.length}</strong><span>Chỉ số xét nghiệm</span></article>
      <article><strong>${fmtDate(stats.last_purchase_at)}</strong><span>Mua gần nhất</span></article>
    </section>
    ${active === "overview" ? renderOverview(profile) : ""}
    ${active === "consultation" ? renderConsultationForm(customer) : ""}
    ${active === "labs" ? renderLabForm(customer.customer_code, metrics) : ""}
  `;
}

function renderOverview(profile) {
  return `
    <section class="grid2">
      <article class="card"><h3>Bệnh lý / vấn đề sức khỏe</h3>${list(profile.conditions, (x) => `<p><strong>${escapeHtml(x.condition_code || x.condition_name || "-")}</strong><span>${escapeHtml(x.status || x.condition_status || "")}</span></p>`)}</article>
      <article class="card"><h3>Sản phẩm liên quan</h3>${list(profile.products, (x) => `<p><strong>${escapeHtml(x.product_name || "-")}</strong><span>${escapeHtml(x.usage_status || "")}</span></p>`)}</article>
      <article class="card"><h3>Lab gần đây</h3>${list(profile.lab_results, (x) => `<p><strong>${escapeHtml(x.metric_code || "-")}</strong><span>${escapeHtml(x.value_numeric ?? x.value_text ?? "-")} ${escapeHtml(x.unit || "")} · ${fmtDate(x.measured_at || x.tested_at)}</span></p>`)}</article>
      <article class="card"><h3>Ghi chú</h3>${list(profile.notes, (x) => `<p><strong>${escapeHtml(x.note_type || "Ghi chú")}</strong><span>${escapeHtml(x.content || "")}</span></p>`)}</article>
    </section>
    <section class="card"><h3>Thêm ghi chú</h3>${noteForm(profile.customer.customer_code)}</section>
  `;
}

function noteForm(customerCode) {
  return `<form class="form" data-note-form data-code="${escapeHtml(customerCode)}"><textarea name="content" rows="3" placeholder="Nhập ghi chú tư vấn, chăm sóc, dặn dò..."></textarea><div class="row"><select name="note_type"><option value="consultation_note">Tư vấn</option><option value="health_profile">Hồ sơ sức khỏe</option><option value="internal_note">Nội bộ</option></select><select name="sensitivity_level"><option value="standard">Thông thường</option><option value="internal">Nội bộ</option><option value="restricted">Hạn chế</option></select><button class="primary" type="submit">Lưu note</button></div></form>`;
}

function renderLabForm(customerCode, metrics) {
  const today = new Date().toISOString().slice(0, 10);
  const options = metrics?.length ? metrics.map((m) => `<option value="${escapeHtml(m.metric_code)}" data-unit="${escapeHtml(m.default_unit || "")}">${escapeHtml(m.metric_name || m.metric_code)}</option>`).join("") : '<option value="custom">Chỉ số khác</option>';
  return `<section class="card"><h3>Nhập chỉ số xét nghiệm</h3><form class="form" data-lab-form data-code="${escapeHtml(customerCode)}"><div class="row"><label>Chỉ số<select name="metric_code">${options}</select></label><label>Giá trị<input name="value" required /></label><label>Đơn vị<input name="unit" /></label><label>Ngày đo<input name="measured_at" type="date" value="${today}" /></label></div><textarea name="notes" rows="3" placeholder="Ghi chú nguồn xét nghiệm..."></textarea><button class="primary" type="submit">Lưu chỉ số</button></form></section>`;
}

function renderConsultationForm(customer) {
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="card"><h3>Phiếu khám nhanh</h3><form class="form" data-visit-form data-id="${escapeHtml(customer.id || "")}" data-code="${escapeHtml(customer.customer_code || "")}"><div class="row"><label>Ngày khám<input name="visit_date" type="date" value="${today}" required /></label><label>Lý do<select name="consultation_reason"><option value="follow_up">Tái khám</option><option value="new_symptom">Triệu chứng mới</option><option value="lab_review">Đọc xét nghiệm</option><option value="product_guidance">Tư vấn sản phẩm</option><option value="other">Khác</option></select></label><label>Mức độ<select name="symptom_severity"><option value="">Chưa ghi nhận</option><option value="mild">Nhẹ</option><option value="moderate">Trung bình</option><option value="severe">Nặng</option></select></label></div><textarea name="symptom_description" rows="3" placeholder="Triệu chứng / vấn đề chính"></textarea><div class="row"><label>Chẩn đoán chính<input name="primary_diagnosis" /></label><label>Triệu chứng hiện tại<input name="current_symptoms" placeholder="Cách nhau bằng dấu phẩy" /></label></div><div class="row compact-row"><label>Chiều cao<input name="height_cm" /></label><label>Cân nặng<input name="weight_kg" /></label><label>Vòng eo<input name="waist_cm" /></label><label>HA tâm thu<input name="blood_pressure_systolic" /></label><label>HA tâm trương<input name="blood_pressure_diastolic" /></label><label>Mạch<input name="pulse_bpm" /></label><label>SpO2<input name="spo2_percent" /></label><label>Đường huyết<input name="blood_glucose_mmol" /></label></div><textarea name="medications" rows="3" placeholder="Thuốc đang dùng, mỗi dòng một thuốc"></textarea><div class="row"><label>Follow-up<select name="followup_type"><option value="">Không tạo</option><option value="product_guidance">Hướng dẫn sản phẩm</option><option value="day_14">Sau 14 ngày</option><option value="day_30">Sau 30 ngày</option><option value="month_3">Sau 3 tháng</option></select></label><label>Ngày follow-up<input name="followup_date" type="date" /></label><label>Ghi chú follow-up<input name="followup_notes" /></label></div><textarea name="notes" rows="3" placeholder="Kết luận, dặn dò, điểm cần theo dõi"></textarea><button class="primary" type="submit">Lưu phiếu khám</button></form></section>`;
}

async function runSearch() {
  const query = els.searchInput.value.trim();
  if (!query) return;
  setBusy(els.searchButton, true, "Đang tìm");
  try { renderResults(await searchCustomers(query)); } catch (error) { els.resultList.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
  finally { setBusy(els.searchButton, false, "Tìm hồ sơ"); }
}

async function openProfile(code) {
  state.selectedCustomerCode = code;
  els.profileContent.innerHTML = '<div class="empty">Đang tải hồ sơ...</div>';
  try {
    const profile = await getCustomerProfile(code);
    if (!profile?.found) throw new Error("Không tìm thấy hồ sơ.");
    profile.ehrSummary = await getPatientSummary(profile.customer.customer_code);
    state.selectedProfile = profile;
    renderProfile(profile);
  } catch (error) { els.profileContent.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
}

function parseMedicationLines(value) {
  return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => ({ medication_name: line, medication_status: "active" }));
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); els.loginError.hidden = true; setBusy(event.submitter, true, "Đang đăng nhập");
  try { await signIn(els.emailInput.value.trim(), els.passwordInput.value); els.passwordInput.value = ""; renderShell(); }
  catch (error) { showError(error.message); }
  finally { setBusy(event.submitter, false, "Đăng nhập"); }
});

els.signOutButton.addEventListener("click", () => { clearSession(); renderShell(); els.resultList.innerHTML = ""; els.profileContent.innerHTML = '<div class="empty">Chọn một khách hàng để xem hồ sơ.</div>'; });
els.searchButton.addEventListener("click", runSearch);
els.searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") runSearch(); });
els.resultList.addEventListener("click", (event) => { const btn = event.target.closest("[data-code]"); if (btn) openProfile(btn.dataset.code); });
document.querySelectorAll(".nav").forEach((btn) => btn.addEventListener("click", () => { state.activeView = btn.dataset.view; renderShell(); }));

els.profileContent.addEventListener("change", (event) => {
  const select = event.target.closest('[data-lab-form] select[name="metric_code"]');
  if (!select) return;
  const unit = select.selectedOptions[0]?.dataset.unit || "";
  const unitInput = select.form.querySelector('[name="unit"]');
  if (unitInput && !unitInput.value) unitInput.value = unit;
});

els.profileContent.addEventListener("submit", async (event) => {
  const noteFormEl = event.target.closest("[data-note-form]");
  const labForm = event.target.closest("[data-lab-form]");
  const visitForm = event.target.closest("[data-visit-form]");
  if (!noteFormEl && !labForm && !visitForm) return;
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]');
  const data = new FormData(event.target);
  setBusy(button, true, "Đang lưu");
  try {
    if (noteFormEl) {
      const content = String(data.get("content") || "").trim();
      if (!content) throw new Error("Vui lòng nhập nội dung ghi chú.");
      await addCustomerNote(noteFormEl.dataset.code, content, data.get("note_type"), data.get("sensitivity_level"));
    }
    if (labForm) {
      const raw = String(data.get("value") || "").trim().replace(",", ".");
      const numeric = raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : null;
      await createLabResult({ customer_ref: labForm.dataset.code, metric_code: data.get("metric_code"), value_numeric: numeric, value_text: numeric === null ? raw : null, unit: String(data.get("unit") || "").trim() || null, measured_at: data.get("measured_at") || null, notes: String(data.get("notes") || "").trim() || "Nhập từ dashboard." });
    }
    if (visitForm) {
      const customerId = visitForm.dataset.id;
      if (!customerId) throw new Error("Thiếu ID khách hàng để tạo phiếu khám.");
      const visitPayload = compact({ customer_id: customerId, visit_date: data.get("visit_date"), consultation_reasons: data.get("consultation_reason") ? [data.get("consultation_reason")] : [], symptom_description: data.get("symptom_description"), current_symptoms: splitList(data.get("current_symptoms")), symptom_severity: data.get("symptom_severity"), primary_diagnosis: data.get("primary_diagnosis"), notes: data.get("notes") });
      const visits = await createVisit(visitPayload);
      const visit = visits?.[0];
      if (!visit?.id) throw new Error("Không nhận được mã lần khám.");
      const vitals = compact({ visit_id: visit.id, customer_id: customerId, height_cm: optionalNumber(data.get("height_cm")), weight_kg: optionalNumber(data.get("weight_kg")), waist_cm: optionalNumber(data.get("waist_cm")), blood_pressure_systolic: optionalInteger(data.get("blood_pressure_systolic")), blood_pressure_diastolic: optionalInteger(data.get("blood_pressure_diastolic")), pulse_bpm: optionalInteger(data.get("pulse_bpm")), spo2_percent: optionalNumber(data.get("spo2_percent")), blood_glucose_mmol: optionalNumber(data.get("blood_glucose_mmol")) });
      if (Object.keys(vitals).length > 2) await createVitals(vitals);
      for (const medication of parseMedicationLines(data.get("medications"))) await createMedication(compact({ ...medication, visit_id: visit.id, customer_id: customerId }));
      if (data.get("followup_type")) await createFollowup(compact({ visit_id: visit.id, customer_id: customerId, followup_type: data.get("followup_type"), scheduled_date: data.get("followup_date"), notes: data.get("followup_notes") }));
    }
    await openProfile(state.selectedCustomerCode);
    window.alert("Đã lưu.");
  } catch (error) { window.alert(error.message || "Không lưu được."); }
  finally { setBusy(button, false, noteFormEl ? "Lưu note" : labForm ? "Lưu chỉ số" : "Lưu phiếu khám"); }
});

renderShell();
