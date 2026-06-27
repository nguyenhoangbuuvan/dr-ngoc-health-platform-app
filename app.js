const SUPABASE_URL = "https://jadstuosnvomswitnhqn.supabase.co";
const SUPABASE_KEY = "sb_publishable_Em171UQLEd05XA_ny7VFtw_SXNlc6XY";

const state = {
  accessToken: localStorage.getItem("drn_access_token") || "",
  refreshToken: localStorage.getItem("drn_refresh_token") || "",
  email: localStorage.getItem("drn_email") || "",
  staff: JSON.parse(localStorage.getItem("drn_staff") || "null"),
  selectedCustomerCode: "",
  currentProfile: null,
  currentEhrSummary: null,
  profileTab: "overview",
  activeView: "customers",
  searchResults: [],
  searchPage: 1,
  searchPageSize: 20,
  recentSearches: JSON.parse(localStorage.getItem("drn_recent_searches") || "[]"),
  reviewQueueFilter: "all",
  aiChatHistory: [], // [{role: "user"|"assistant", content: string, customer_code?: string}]
  aiChatPending: false,
  aiChatRequestId: 0,
};

const els = {
  navCustomers: document.getElementById("navCustomers"),
  navDuplicates: document.getElementById("navDuplicates"),
  navReviewQueue: document.getElementById("navReviewQueue"),
  navMonitoring: document.getElementById("navMonitoring"),
  reviewQueueBadge: document.getElementById("reviewQueueBadge"),
  loginPanel: document.getElementById("loginPanel"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  workspace: document.getElementById("workspace"),
  customersView: document.getElementById("customersView"),
  duplicatesView: document.getElementById("duplicatesView"),
  reviewQueueView: document.getElementById("reviewQueueView"),
  monitoringView: document.getElementById("monitoringView"),
  sessionState: document.getElementById("sessionState"),
  signOutButton: document.getElementById("signOutButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  topbarTitle: document.getElementById("topbarTitle"),
  summaryLine: document.getElementById("summaryLine"),
  searchInput: document.getElementById("searchInput"),
  searchButton: document.getElementById("searchButton"),
  searchClearButton: document.getElementById("searchClearButton"),
  recentSearches: document.getElementById("recentSearches"),
  resultList: document.getElementById("resultList"),
  resultCount: document.getElementById("resultCount"),
  profileContent: document.getElementById("profileContent"),
  profileStatus: document.getElementById("profileStatus"),
  auditList: document.getElementById("auditList"),
  refreshAuditButton: document.getElementById("refreshAuditButton"),
  refreshDuplicatesButton: document.getElementById("refreshDuplicatesButton"),
  duplicateTotal: document.getElementById("duplicateTotal"),
  duplicateLoaded: document.getElementById("duplicateLoaded"),
  duplicateList: document.getElementById("duplicateList"),
  refreshReviewQueueButton: document.getElementById("refreshReviewQueueButton"),
  reviewQueueTotal: document.getElementById("reviewQueueTotal"),
  reviewQueueLoaded: document.getElementById("reviewQueueLoaded"),
  reviewQueueList: document.getElementById("reviewQueueList"),
  filterAll: document.getElementById("filterAll"),
  filterCondition: document.getElementById("filterCondition"),
  filterLab: document.getElementById("filterLab"),
  rolePill: document.getElementById("rolePill"),
  permissionStrip: document.getElementById("permissionStrip"),
  resultPagination: document.getElementById("resultPagination"),
  auditAdminList: document.getElementById("auditAdminList"),
  refreshAuditAdminButton: document.getElementById("refreshAuditAdminButton"),
  refreshMonitoringButton: document.getElementById("refreshMonitoringButton"),
  monitoringSummary: document.getElementById("monitoringSummary"),
  monitoringLoaded: document.getElementById("monitoringLoaded"),
  monitoringList: document.getElementById("monitoringList"),
  navAiChat: document.getElementById("navAiChat"),
  aiChatView: document.getElementById("aiChatView"),
  aiClearChat: document.getElementById("aiClearChat"),
  aiChatMessages: document.getElementById("aiChatMessages"),
  aiChatForm: document.getElementById("aiChatForm"),
  aiChatInput: document.getElementById("aiChatInput"),
  aiChatSend: document.getElementById("aiChatSend"),
};

function setBusy(element, busy, label) {
  element.disabled = busy;
  if (label) element.textContent = label;
}

function showError(message) {
  els.loginError.textContent = message;
  els.loginError.hidden = false;
}

function clearError() {
  els.loginError.textContent = "";
  els.loginError.hidden = true;
}

function saveSession(session, email) {
  state.accessToken = session.access_token;
  state.refreshToken = session.refresh_token;
  state.email = email;
  localStorage.setItem("drn_access_token", state.accessToken);
  localStorage.setItem("drn_refresh_token", state.refreshToken);
  localStorage.setItem("drn_email", state.email);
}

function saveStaffContext(staff) {
  state.staff = staff || null;
  if (state.staff) localStorage.setItem("drn_staff", JSON.stringify(state.staff));
  else localStorage.removeItem("drn_staff");
}

function clearSession() {
  state.aiChatRequestId += 1;
  state.aiChatPending = false;
  state.accessToken = "";
  state.refreshToken = "";
  state.email = "";
  state.staff = null;
  state.selectedCustomerCode = "";
  state.currentProfile = null;
  state.currentEhrSummary = null;
  state.profileTab = "overview";
  state.searchResults = [];
  state.searchPage = 1;
  localStorage.removeItem("drn_access_token");
  localStorage.removeItem("drn_refresh_token");
  localStorage.removeItem("drn_email");
  localStorage.removeItem("drn_staff");
}

function renderSession() {
  const signedIn = Boolean(state.accessToken);
  const isAdmin = isAdminRole();
  els.loginPanel.hidden = signedIn;
  els.workspace.hidden = !signedIn;
  els.signOutButton.hidden = !signedIn;
  els.sessionState.textContent = signedIn ? (state.staff?.full_name || state.email) : "Chưa đăng nhập";
  els.connectionStatus.textContent = signedIn ? "Đã kết nối Supabase" : "Dashboard nội bộ";
  if (els.rolePill) {
    els.rolePill.hidden = !signedIn;
    els.rolePill.textContent = signedIn ? roleLabel(state.staff?.role) : "";
  }
  document.querySelectorAll(".admin-only").forEach((item) => {
    item.hidden = !signedIn || !isAdmin;
  });
  if (signedIn && !isAdmin && ["duplicates", "review-queue", "monitoring"].includes(state.activeView)) {
    state.activeView = "customers";
  }
  renderPermissionStrip();
  renderRecentSearches();
  renderView();
}

function renderPermissionStrip() {
  if (!els.permissionStrip) return;
  if (!state.accessToken) {
    els.permissionStrip.hidden = true;
    els.permissionStrip.innerHTML = "";
    return;
  }

  const role = state.staff?.role || "staff";
  const copy = isAdminRole()
    ? "Quyền quản lý: được review dữ liệu, xem audit, nhập xét nghiệm confirmed và rà soát trùng."
    : "Quyền nhân viên: tra cứu khách, xem hồ sơ, tạo phiếu khám và ghi note. Audit, merge, review và nhập xét nghiệm confirmed bị khóa.";
  els.permissionStrip.hidden = false;
  els.permissionStrip.innerHTML = `
    <span class="badge ${isAdminRole() ? "blue" : ""}">${escapeHtml(roleLabel(role))}</span>
    <span>${escapeHtml(copy)}</span>
  `;
}

function renderView() {
  const v = state.activeView;
  els.customersView.hidden = v !== "customers";
  els.duplicatesView.hidden = v !== "duplicates";
  els.reviewQueueView.hidden = v !== "review-queue";
  els.monitoringView.hidden = v !== "monitoring";
  els.aiChatView.hidden = v !== "ai-chat";
  els.navCustomers.classList.toggle("active", v === "customers");
  els.navDuplicates.classList.toggle("active", v === "duplicates");
  els.navReviewQueue.classList.toggle("active", v === "review-queue");
  els.navMonitoring.classList.toggle("active", v === "monitoring");
  els.navAiChat.classList.toggle("active", v === "ai-chat");
  const viewCopy = {
    customers: ["Hồ sơ khách hàng", "Tra cứu, xem timeline, nhập note, xét nghiệm và phiếu khám."],
    duplicates: ["Quản trị · Rà soát trùng", "Rà soát các hồ sơ có khả năng trùng số điện thoại hoặc định danh."],
    "review-queue": ["Quản trị · Review Queue", "Tất cả gợi ý sức khỏe chưa được duyệt từ mọi khách hàng."],
    monitoring: ["Quản trị · Realtime / Audit", "Theo dõi luồng Pancake → n8n → Supabase và hoạt động gần nhất."],
    "ai-chat": ["AI Chat", "Hỏi AI về khách hàng, hồ sơ sức khỏe và lịch sử giao dịch."],
  };
  els.topbarTitle.textContent = viewCopy[v]?.[0] ?? "";
  els.summaryLine.textContent = viewCopy[v]?.[1] ?? "";
}

async function switchView(view) {
  if (["duplicates", "review-queue", "monitoring"].includes(view) && !isAdminRole()) {
    window.alert("Tài khoản nhân viên không có quyền mở khu quản trị.");
    state.activeView = "customers";
    renderView();
    return;
  }
  state.activeView = view;
  renderView();
  if (view === "duplicates") await loadDuplicateGroups();
  if (view === "review-queue") await loadReviewQueue();
  if (view === "monitoring") await loadRealtimeMonitor();
  if (view === "ai-chat") renderAiChatHistory();
}

async function supabaseFetch(path, options = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${state.accessToken || SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || "Đăng nhập thất bại");
  }

  saveSession(payload, email);
}

async function getStaffContext() {
  return supabaseFetch("/rest/v1/rpc/api_get_staff_context", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function searchCustomers(query) {
  return supabaseFetch("/rest/v1/rpc/api_search_customers_operational", {
    method: "POST",
    body: JSON.stringify({ search_text: query, max_results: 200 }),
  });
}

async function getCustomerProfile(customerRef) {
  return supabaseFetch("/rest/v1/rpc/api_get_customer_profile", {
    method: "POST",
    body: JSON.stringify({ customer_ref: customerRef }),
  });
}

async function getCustomerContactsOperational(customerRef) {
  return supabaseFetch("/rest/v1/rpc/api_get_customer_contacts_operational", {
    method: "POST",
    body: JSON.stringify({ customer_ref: customerRef }),
  });
}

async function getPatientRecordSummary(customerCode) {
  const rows = await supabaseFetch(
    `/rest/v1/patient_record_summary?select=*&customer_code=eq.${encodeURIComponent(customerCode)}&limit=1`
  );
  return rows?.[0] || null;
}

async function getAuditLogs() {
  return supabaseFetch(
    "/rest/v1/audit_logs?select=action,entity_type,customer_id,metadata,created_at&order=created_at.desc&limit=12"
  );
}

async function approveConditionCandidate(candidateId) {
  return supabaseFetch("/rest/v1/rpc/api_approve_condition_candidate", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId }),
  });
}

async function rejectConditionCandidate(candidateId, reviewNotes) {
  return supabaseFetch("/rest/v1/rpc/api_reject_condition_candidate", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId, review_notes: reviewNotes }),
  });
}

async function approveLabResultCandidate(candidateId) {
  return supabaseFetch("/rest/v1/rpc/api_approve_lab_result_candidate", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId }),
  });
}

async function rejectLabResultCandidate(candidateId, reviewNotes) {
  return supabaseFetch("/rest/v1/rpc/api_reject_lab_result_candidate", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId, review_notes: reviewNotes }),
  });
}

async function createLabResult(payload) {
  return supabaseFetch("/rest/v1/rpc/api_create_lab_result", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function getDuplicateReviewGroups() {
  return supabaseFetch("/rest/v1/rpc/api_get_duplicate_review_groups", {
    method: "POST",
    body: JSON.stringify({ max_groups: 50 }),
  });
}

async function previewCustomerMerge(candidateId) {
  return supabaseFetch("/rest/v1/rpc/api_preview_customer_merge", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId }),
  });
}

async function mergeCustomerGroup(candidateId) {
  return supabaseFetch("/rest/v1/rpc/api_merge_customers", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId }),
  });
}

async function getRealtimeMonitor() {
  return supabaseFetch("/rest/v1/rpc/api_get_realtime_monitor", {
    method: "POST",
    body: JSON.stringify({ max_events: 50 }),
  });
}

async function updateCustomerProfile(customerRef, fields) {
  return supabaseFetch("/rest/v1/rpc/api_update_customer_profile", {
    method: "POST",
    body: JSON.stringify({ customer_ref: customerRef, ...fields }),
  });
}

async function addCustomerNote(customerRef, content, noteType, sensitivityLevel) {
  return supabaseFetch("/rest/v1/rpc/api_add_customer_note", {
    method: "POST",
    body: JSON.stringify({
      customer_ref: customerRef,
      content,
      note_type: noteType,
      sensitivity_level: sensitivityLevel,
    }),
  });
}

async function createConsultationVisit(payload) {
  return supabaseFetch("/rest/v1/consultation_visits?select=id,visit_number,visit_date", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

async function createConsultationVitals(payload) {
  return supabaseFetch("/rest/v1/consultation_vitals?select=id,bmi", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

async function createConsultationMedication(payload) {
  return supabaseFetch("/rest/v1/consultation_medications?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

async function createConsultationFollowup(payload) {
  return supabaseFetch("/rest/v1/consultation_followups?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

async function dismissDuplicateGroup(candidateId, decisionNotes) {
  return supabaseFetch("/rest/v1/rpc/api_dismiss_duplicate_group", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId, decision_notes: decisionNotes || null }),
  });
}

async function listPendingHealthCandidates(type, maxItems) {
  return supabaseFetch("/rest/v1/rpc/api_list_pending_health_candidates", {
    method: "POST",
    body: JSON.stringify({ p_type: type || "all", p_max_items: maxItems || 100 }),
  });
}

async function revealDuplicateGroupPhones(candidateId) {
  return supabaseFetch("/rest/v1/rpc/api_reveal_duplicate_group_phones", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId }),
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("vi-VN").format(Number(value));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function renderResults(results = state.searchResults) {
  const total = results.length;
  const pageSize = state.searchPageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  state.searchPage = Math.min(Math.max(state.searchPage, 1), pageCount);
  const start = (state.searchPage - 1) * pageSize;
  const pageItems = results.slice(start, start + pageSize);

  els.resultCount.textContent = total ? `${start + 1}-${start + pageItems.length}/${total}` : "0";
  if (!total) {
    els.resultList.innerHTML = '<div class="empty-state">Không có kết quả. Thử tìm bằng số điện thoại không dấu cách, mã DNG-CUS hoặc một phần tên khách.</div>';
    if (els.resultPagination) els.resultPagination.hidden = true;
    return;
  }

  els.resultList.innerHTML = pageItems
    .map(
      (item) => `
        <button class="result-button" type="button" data-code="${item.customer_code}">
          <div class="result-main">
            <span>${escapeHtml(item.full_name || "Không tên")}</span>
            <span>${escapeHtml(item.customer_code)}</span>
          </div>
          <div class="result-meta">
            ${escapeHtml(displayPhone(item))} · ${escapeHtml(matchReasonLabel(item.match_reason))} · ${escapeHtml(dataQualityLabel(item.data_quality_status))}
          </div>
        </button>
      `
    )
    .join("");

  renderPagination(pageCount);
}

function renderPagination(pageCount) {
  if (!els.resultPagination) return;
  if (pageCount <= 1) {
    els.resultPagination.hidden = true;
    els.resultPagination.innerHTML = "";
    return;
  }

  els.resultPagination.hidden = false;
  const pages = [];
  for (let page = 1; page <= pageCount; page += 1) {
    pages.push(`<button class="page-button ${page === state.searchPage ? "active" : ""}" type="button" data-page="${page}">${page}</button>`);
  }
  els.resultPagination.innerHTML = `
    <button class="page-button" type="button" data-page="${Math.max(1, state.searchPage - 1)}">Trước</button>
    ${pages.join("")}
    <button class="page-button" type="button" data-page="${Math.min(pageCount, state.searchPage + 1)}">Sau</button>
  `;
}

function displayPhone(item) {
  return item?.primary_phone || item?.phone || item?.normalized_value || item?.display_value || item?.masked_primary_phone || "-";
}

function renderDuplicateGroups(payload) {
  const groups = payload?.groups || [];
  els.duplicateTotal.textContent = String(payload?.total_open_groups ?? groups.length);
  els.duplicateLoaded.textContent = `Đang hiển thị ${groups.length} nhóm đầu tiên`;

  if (!groups.length) {
    els.duplicateList.innerHTML = '<div class="empty-state">Chưa có hồ sơ cần rà soát.</div>';
    return;
  }

  els.duplicateList.innerHTML = groups
    .map(
      (group) => `
        <article class="duplicate-group" data-duplicate-id="${escapeHtml(group.id)}">
          <div class="duplicate-group-header">
            <div>
              <div class="eyebrow">${escapeHtml(duplicateTypeLabel(group.candidate_type))}</div>
              <h4>${escapeHtml(group.masked_key || "-")}</h4>
              <p>${escapeHtml(duplicateReasonLabel(group.reason))}</p>
            </div>
            <div class="duplicate-actions">
              <span class="badge warning">${escapeHtml(group.customer_count || 0)} hồ sơ</span>
              <span class="badge">${escapeHtml(confidenceLabel(group.confidence_score))}</span>
              <button class="small-button reveal" type="button" data-action="reveal-phones" data-id="${escapeHtml(group.id)}">Hiện số điện thoại</button>
              <button class="small-button" type="button" data-action="preview-merge" data-id="${escapeHtml(group.id)}">Xem tác động</button>
              <button class="small-button danger" type="button" data-action="dismiss-group" data-id="${escapeHtml(group.id)}">Không phải trùng</button>
            </div>
          </div>
          <div class="revealed-phone-list" data-phone-list="${escapeHtml(group.id)}" hidden></div>
          <div class="merge-preview" data-merge-preview="${escapeHtml(group.id)}" hidden></div>
          <div class="duplicate-customer-grid">
            ${(group.customers || []).map(renderDuplicateCustomer).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderDuplicateCustomer(customer) {
  return `
    <article class="duplicate-customer-card">
      <div class="duplicate-customer-head">
        <div>
          <strong>${escapeHtml(customer.full_name || "Không tên")}</strong>
          <span>${escapeHtml(customer.customer_code)}</span>
        </div>
        <button class="small-button" type="button" data-action="open-customer" data-code="${escapeHtml(customer.customer_code)}">Mở hồ sơ</button>
      </div>
      <div class="kv-list">
        ${kv("Điện thoại", customer.masked_primary_phone || "-")}
        ${kv("Lần mua", customer.purchase_count ?? 0)}
        ${kv("Mua cuối", formatDate(customer.last_purchase_at))}
        ${kv("Đã chi", `${formatMoney(customer.total_spent_vnd)} VND`)}
      </div>
      <p>${escapeHtml(customer.address_preview || "Chưa có địa chỉ.")}</p>
    </article>
  `;
}

function renderRevealedPhones(payload) {
  const phones = payload?.phones || [];
  if (!phones.length) return '<div class="empty-state compact">Không có số điện thoại hợp lệ.</div>';
  return phones
    .map(
      (item) => `
        <div class="revealed-phone-item">
          <span>${escapeHtml(item.customer_code)} · ${escapeHtml(item.full_name || "Không tên")}</span>
          <strong>${escapeHtml(item.phone || "-")}</strong>
        </div>
      `
    )
    .join("");
}

function renderProfile(profile, ehrSummary = null) {
  if (!profile || !profile.found) {
    els.profileStatus.textContent = "Không thấy";
    els.profileContent.innerHTML = '<div class="empty-state">Không tìm thấy hồ sơ.</div>';
    return;
  }

  const customer = profile.customer;
  const contacts = profile.contacts || [];
  const addresses = profile.addresses || [];
  const sources = profile.sources || [];
  const products = profile.products || [];
  const notes = profile.notes || [];
  const conditions = profile.conditions || [];
  const conditionCandidates = profile.condition_candidates || [];
  const labResults = profile.lab_results || [];
  const labResultCandidates = profile.lab_result_candidates || [];
  const recommendedLabMetrics = profile.recommended_lab_metrics || [];
  const stats = profile.stats || {};
  state.currentProfile = profile;
  state.currentEhrSummary = ehrSummary;

  els.profileStatus.textContent = customer.customer_code;
  els.profileContent.innerHTML = `
    <div class="profile-hero">
      <div class="avatar">${escapeHtml(initials(customer.full_name))}</div>
      <div class="profile-identity">
        <div class="eyebrow">Hồ sơ khách hàng</div>
        <h4>${escapeHtml(customer.full_name || "Không tên")}</h4>
        <div class="result-meta">${escapeHtml(customer.customer_uuid)}</div>
      </div>
      <div class="profile-code">
        <strong>${escapeHtml(customer.customer_code)}</strong>
        <span class="badge ${badgeTone(customer.data_quality_status)}">${escapeHtml(dataQualityLabel(customer.data_quality_status))}</span>
        <button class="small-button" type="button" data-action="toggle-edit-profile">Sửa thông tin</button>
      </div>
    </div>

    <div class="profile-action-bar">
      <button class="small-button" type="button" data-profile-tab="overview">Tổng quan</button>
      <button class="small-button" type="button" data-profile-tab="timeline">Timeline</button>
      <button class="small-button" type="button" data-profile-tab="consultation">Phiếu khám</button>
      <button class="small-button" type="button" data-profile-tab="labs">Xét nghiệm</button>
      <button class="small-button" type="button" data-action="open-ai-for-customer" data-code="${escapeHtml(customer.customer_code)}" data-name="${escapeHtml(customer.full_name || "")}">Hỏi AI</button>
      <button class="small-button" type="button" data-action="print-profile">In hồ sơ</button>
    </div>

    <form class="edit-profile-form" data-edit-profile-form data-customer-code="${escapeHtml(customer.customer_code)}" hidden>
      <div class="edit-profile-fields">
        <label>Tên đầy đủ<input name="full_name" type="text" value="${escapeHtml(customer.full_name || "")}" placeholder="Tên khách hàng" /></label>
        <label>Giới tính
          <select name="gender">
            <option value="unknown" ${customer.gender === "unknown" ? "selected" : ""}>Chưa rõ</option>
            <option value="female"  ${customer.gender === "female"  ? "selected" : ""}>Nữ</option>
            <option value="male"    ${customer.gender === "male"    ? "selected" : ""}>Nam</option>
          </select>
        </label>
        <label>Ngày sinh<input name="birth_date" type="date" value="${escapeHtml(customer.birth_date || "")}" /></label>
      </div>
      <div class="edit-profile-actions">
        <button class="primary-button" type="submit">Lưu thay đổi</button>
        <button class="ghost-button" type="button" data-action="toggle-edit-profile">Hủy</button>
      </div>
    </form>
    ${renderQualityNotice(customer.data_quality_status, stats)}

    ${renderProfileTabs()}
    ${renderProfileTabPanel("overview", renderOperationalOverview({ customer, contacts, addresses, sources, products, notes, conditions, conditionCandidates, labResultCandidates, stats, ehrSummary, labResults }))}
    ${renderProfileTabPanel("timeline", renderTimeline(profile, ehrSummary))}
    ${renderProfileTabPanel("consultation", renderConsultationVisitForm(customer))}
    ${renderProfileTabPanel("labs", renderLabsWorkspace(customer.customer_code, labResults, recommendedLabMetrics))}
  `;
}

function renderProfileTabs() {
  const tabs = [
    ["overview", "Tổng quan EMR"],
    ["timeline", "Timeline"],
    ["consultation", "Phiếu khám"],
    ["labs", "Xét nghiệm"],
  ];
  return `
    <div class="profile-tabs">
      ${tabs.map(([key, label]) => `<button class="profile-tab ${state.profileTab === key ? "active" : ""}" type="button" data-profile-tab="${key}">${escapeHtml(label)}</button>`).join("")}
    </div>
  `;
}

function renderProfileTabPanel(tab, content) {
  return `<div class="profile-tab-panel" data-profile-panel="${escapeHtml(tab)}" ${state.profileTab === tab ? "" : "hidden"}>${content}</div>`;
}

function renderOperationalOverview(data) {
  const { customer, contacts, addresses, sources, products, notes, conditions, conditionCandidates, labResultCandidates, stats, ehrSummary, labResults } = data;
  return `
    <div class="summary-strip">
      ${summaryItem("Ghi chú", stats.note_count ?? 0)}
      ${summaryItem("Gợi ý bệnh lý", stats.condition_candidate_pending_count ?? 0)}
      ${summaryItem("Gợi ý xét nghiệm", stats.lab_result_candidate_pending_count ?? 0)}
      ${summaryItem("Lần khám", ehrSummary?.latest_visit_number ?? 0)}
    </div>

    ${renderEhrOverview(ehrSummary, conditions, labResults, products)}

    <div class="patient-grid">
      <section class="info-card">
        <h5>Thông tin</h5>
        <div class="kv-list">
          ${kv("Mã khách", customer.customer_code)}
          ${kv("Giới tính", genderLabel(customer.gender))}
          ${kv("Lần mua", customer.purchase_count)}
          ${kv("Mua cuối", formatDate(customer.last_purchase_at))}
          ${kv("Đã chi", `${formatMoney(customer.total_spent_vnd)} VND`)}
        </div>
      </section>

      <section class="info-card">
        <h5>Liên hệ</h5>
        <div class="kv-list">
          ${contacts.map((contact) => kv(contactLabel(contact.contact_type), displayPhone(contact))).join("") || kv("Liên hệ", "-")}
        </div>
      </section>

      <section class="info-card">
        <h5>Địa chỉ</h5>
        <div class="kv-list">
          ${addresses.slice(0, 6).map((address) => kv(`#${address.address_order}`, address.address_raw)).join("") || kv("Địa chỉ", "-")}
        </div>
      </section>

      <section class="info-card">
        <h5>Nguồn dữ liệu</h5>
        <div class="kv-list">
          ${sources.map((source) => kv(`#${source.source_order}`, source.source_name_raw)).join("") || kv("Nguồn", "-")}
        </div>
      </section>
    </div>

    <div class="patient-grid">
      <section class="info-card">
        <h5>Sản phẩm đang dùng</h5>
        ${renderProducts(products)}
      </section>
      <section class="info-card">
        <h5>Bệnh lý đã xác nhận</h5>
        ${renderConditions(conditions)}
      </section>
    </div>

    ${isAdminRole() ? renderReviewSuggestions(conditionCandidates, labResultCandidates) : ""}
    ${renderNotesWorkspace(customer.customer_code, notes)}
  `;
}

function renderReviewSuggestions(conditionCandidates, labResultCandidates) {
  return `
    <section class="info-card wide-card">
      <div class="section-heading">
        <h5>Gợi ý chờ duyệt</h5>
        <span>Khu quản trị: owner/manager duyệt AI/rules trước khi ghi chính thức.</span>
      </div>
      <div class="health-grid">
        <div>
          <div class="mini-title">Bệnh lý</div>
          ${renderConditionCandidates(conditionCandidates)}
        </div>
        <div>
          <div class="mini-title">Chỉ số</div>
          ${renderLabResultCandidates(labResultCandidates)}
        </div>
      </div>
    </section>
  `;
}

function renderNotesWorkspace(customerCode, notes) {
  return `
    <section class="info-card wide-card">
      <h5>Ghi chú gần nhất</h5>
      <div class="note-list">
        ${
          notes
            .map(
              (note) => `
                <article class="note">
                  <span class="badge">${escapeHtml(note.sensitivity_level)}</span>
                  <p>${escapeHtml(note.content || "")}</p>
                </article>
              `
            )
            .join("") || '<div class="empty-state">Không có ghi chú.</div>'
        }
      </div>
    </section>

    <section class="info-card wide-card">
      <h5>Thêm ghi chú</h5>
      <form class="add-note-form" data-add-note-form data-customer-code="${escapeHtml(customerCode)}">
        <textarea name="content" rows="3" placeholder="Nội dung ghi chú…"></textarea>
        <div class="add-note-selects">
          <label>Loại ghi chú
            <select name="note_type">
              <option value="consultation_note">Tư vấn</option>
              <option value="health_profile">Hồ sơ sức khỏe</option>
              <option value="conversation_note">Hội thoại</option>
              <option value="internal_note">Nội bộ</option>
            </select>
          </label>
          <label>Độ bảo mật
            <select name="sensitivity_level">
              <option value="standard">Thông thường</option>
              <option value="internal">Nội bộ</option>
              <option value="restricted">Hạn chế</option>
            </select>
          </label>
        </div>
        <div class="add-note-actions">
          <button class="primary-button" type="submit">Thêm ghi chú</button>
        </div>
      </form>
    </section>
  `;
}

function renderLabsWorkspace(customerCode, labResults, recommendedLabMetrics) {
  return `
    <div class="patient-grid">
      <section class="info-card">
        <h5>Chỉ số xét nghiệm</h5>
        ${renderLabResults(labResults)}
      </section>
      <section class="info-card">
        <h5>${isAdminRole() ? "Nhập chỉ số" : "Nhập chỉ số bị khóa"}</h5>
        ${isAdminRole() ? renderLabEntryForm(customerCode, recommendedLabMetrics) : renderReadOnlyLabNotice()}
      </section>
    </div>
    <section class="info-card wide-card">
      <h5>Chỉ số nên theo dõi</h5>
      ${renderRecommendedLabMetrics(recommendedLabMetrics)}
    </section>
  `;
}

function renderReadOnlyLabNotice() {
  return `
    <div class="permission-note">
      <strong>Staff chỉ xem xét nghiệm đã xác nhận.</strong>
      <span>Nhập kết quả xét nghiệm confirmed là thao tác dữ liệu sức khỏe, hiện chỉ owner/manager được làm. Nếu cần nhập mới, chuyển hồ sơ cho quản lý review.</span>
    </div>
  `;
}

function renderTimeline(profile, ehrSummary) {
  const items = buildTimelineItems(profile, ehrSummary);
  if (!items.length) {
    return '<section class="info-card wide-card"><div class="empty-state">Chưa có dữ liệu timeline.</div></section>';
  }

  return `
    <section class="info-card wide-card timeline-card">
      <div class="section-heading">
        <div>
          <h5>Timeline chăm sóc</h5>
          <span>Ghép note, lab, bệnh lý, sản phẩm và lần khám gần nhất theo thời gian.</span>
        </div>
        <button class="ghost-button" type="button" data-action="print-profile">In hồ sơ</button>
      </div>
      <div class="timeline-list">
        ${items
          .map(
            (item) => `
              <article class="timeline-item ${escapeHtml(item.tone || "")}">
                <div class="timeline-dot"></div>
                <div class="timeline-body">
                  <div class="timeline-head">
                    <span class="badge ${escapeHtml(item.tone || "")}">${escapeHtml(item.type)}</span>
                    <time>${escapeHtml(formatDateTimeOrDate(item.date))}</time>
                  </div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <p>${escapeHtml(item.detail || "")}</p>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function buildTimelineItems(profile, ehrSummary) {
  const items = [];
  if (ehrSummary?.latest_visit_date || ehrSummary?.latest_visit_id) {
    items.push({
      type: "Lần khám",
      tone: "blue",
      date: ehrSummary.latest_visit_date,
      title: ehrSummary.latest_diagnosis || `Lần khám #${ehrSummary.latest_visit_number || ""}`,
      detail: "Lần khám gần nhất trong bệnh án điện tử.",
    });
  }

  for (const note of profile.notes || []) {
    items.push({
      type: "Ghi chú",
      tone: "neutral",
      date: note.created_at,
      title: note.note_type || "Ghi chú",
      detail: note.content || "",
    });
  }

  for (const lab of profile.lab_results || []) {
    items.push({
      type: "Xét nghiệm",
      tone: "warning",
      date: lab.measured_at || lab.confirmed_at,
      title: lab.metric_name || lab.metric_code,
      detail: metricValue(lab),
    });
  }

  for (const condition of profile.conditions || []) {
    items.push({
      type: "Bệnh lý",
      tone: "success",
      date: condition.confirmed_at || condition.last_observed_at || condition.first_observed_at,
      title: condition.condition_name || condition.condition_code,
      detail: conditionStatusLabel(condition.current_status),
    });
  }

  for (const product of profile.products || []) {
    items.push({
      type: "Sản phẩm",
      tone: "blue",
      date: product.last_seen_at || product.first_seen_at,
      title: product.product_name || "Sản phẩm",
      detail: productStatusLabel(product.usage_status),
    });
  }

  return items
    .filter((item) => item.title)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 80);
}

function formatDateTimeOrDate(value) {
  if (!value) return "Chưa rõ ngày";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hasTime = String(value).includes("T") || String(value).includes(":");
  return hasTime ? formatDateTime(value) : formatDate(value);
}

function renderConsultationVisitForm(customer) {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <section class="info-card wide-card consultation-card">
      <div class="section-heading">
        <div>
          <h5>Phiếu khám nhanh</h5>
          <span>Tạo lần khám, sinh hiệu, thuốc đang dùng và lịch follow-up trong một lần lưu.</span>
        </div>
        <span class="badge blue">EHR</span>
      </div>
      <form class="consultation-form" data-consultation-form data-customer-id="${escapeHtml(customer.id)}" data-customer-code="${escapeHtml(customer.customer_code)}">
        <div class="consultation-grid">
          <label>Ngày khám
            <input name="visit_date" type="date" value="${escapeHtml(today)}" required />
          </label>
          <label>Lý do khám
            <select name="consultation_reason">
              <option value="follow_up">Tái khám / follow-up</option>
              <option value="new_symptom">Triệu chứng mới</option>
              <option value="lab_review">Đọc kết quả xét nghiệm</option>
              <option value="product_guidance">Hướng dẫn dùng sản phẩm</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <label>Thời gian khởi phát
            <select name="onset_duration">
              <option value="">Chưa ghi nhận</option>
              <option value="acute">Cấp tính</option>
              <option value="subacute">Bán cấp</option>
              <option value="chronic">Mạn tính</option>
              <option value="lt_1_month">&lt; 1 tháng</option>
              <option value="1_6_months">1-6 tháng</option>
              <option value="6_12_months">6-12 tháng</option>
              <option value="gt_1_year">&gt; 1 năm</option>
            </select>
          </label>
          <label>Mức độ
            <select name="symptom_severity">
              <option value="">Chưa ghi nhận</option>
              <option value="mild">Nhẹ</option>
              <option value="moderate">Trung bình</option>
              <option value="severe">Nặng</option>
            </select>
          </label>
        </div>

        <label>Triệu chứng / vấn đề chính
          <textarea name="symptom_description" rows="3" placeholder="VD: Mệt, khó ngủ, huyết áp dao động, cần tư vấn sau xét nghiệm..."></textarea>
        </label>

        <div class="consultation-grid">
          <label>Chẩn đoán chính
            <input name="primary_diagnosis" placeholder="VD: Tăng huyết áp cần theo dõi" />
          </label>
          <label>Triệu chứng hiện tại
            <input name="current_symptoms" placeholder="Cách nhau bằng dấu phẩy" />
          </label>
        </div>

        <div class="vitals-grid">
          <label>Chiều cao cm<input name="height_cm" inputmode="decimal" placeholder="165" /></label>
          <label>Cân nặng kg<input name="weight_kg" inputmode="decimal" placeholder="62" /></label>
          <label>Vòng eo cm<input name="waist_cm" inputmode="decimal" placeholder="82" /></label>
          <label>HA tâm thu<input name="blood_pressure_systolic" inputmode="numeric" placeholder="120" /></label>
          <label>HA tâm trương<input name="blood_pressure_diastolic" inputmode="numeric" placeholder="80" /></label>
          <label>Mạch<input name="pulse_bpm" inputmode="numeric" placeholder="76" /></label>
          <label>SpO2 %<input name="spo2_percent" inputmode="decimal" placeholder="98" /></label>
          <label>Đường huyết mmol/L<input name="blood_glucose_mmol" inputmode="decimal" placeholder="5.6" /></label>
        </div>

        <div class="consultation-grid">
          <label>Thuốc đang dùng
            <textarea name="medications" rows="3" placeholder="Mỗi dòng một thuốc. VD: Metformin 500mg | sáng tối | sau ăn"></textarea>
          </label>
          <label>Follow-up
            <div class="followup-inline">
              <select name="followup_type">
                <option value="">Không tạo</option>
                <option value="product_guidance">Hướng dẫn sản phẩm</option>
                <option value="day_14">Sau 14 ngày</option>
                <option value="day_30">Sau 30 ngày</option>
                <option value="month_3">Sau 3 tháng</option>
              </select>
              <input name="followup_date" type="date" />
              <input name="followup_notes" placeholder="Ghi chú follow-up" />
            </div>
          </label>
        </div>

        <label>Ghi chú phiếu khám
          <textarea name="notes" rows="3" placeholder="Kết luận, dặn dò, điểm cần theo dõi..."></textarea>
        </label>

        <div class="consultation-actions">
          <button class="primary-button" type="submit">Lưu phiếu khám</button>
          <button class="ghost-button" type="button" data-action="print-consultation">In phiếu</button>
          <span class="form-hint">Staff chỉ tạo mới; owner/manager có quyền quản lý sâu hơn theo RLS.</span>
        </div>
      </form>
    </section>
  `;
}

function renderEhrOverview(ehr, conditions, labResults, products) {
  if (ehr?.load_error) {
    return `
      <section class="ehr-overview">
        <div class="ehr-overview-head">
          <div>
            <div class="eyebrow">Bệnh án điện tử</div>
            <h5>Chưa tải được dữ liệu bệnh án</h5>
          </div>
          <span class="badge warning">Cần kiểm tra quyền API</span>
        </div>
        <div class="merge-warning danger">
          <strong>Không ảnh hưởng hồ sơ khách hàng</strong>
          <span>${escapeHtml(ehr.load_error)}</span>
        </div>
      </section>
    `;
  }

  const conditionNames = (conditions || [])
    .slice(0, 3)
    .map((item) => item.condition_name || item.condition_code)
    .filter(Boolean);
  const latestLabs = (labResults || []).slice(0, 3);
  const activeProducts = (products || [])
    .filter((item) => ["using", "purchased"].includes(item.usage_status))
    .slice(0, 3);

  return `
    <section class="ehr-overview">
      <div class="ehr-overview-head">
        <div>
          <div class="eyebrow">Bệnh án điện tử</div>
          <h5>${escapeHtml(ehr?.latest_diagnosis || "Chưa có chẩn đoán chính")}</h5>
        </div>
        <span class="badge ${ehr?.latest_visit_id ? "success" : "warning"}">
          ${ehr?.latest_visit_id ? `Lần khám #${escapeHtml(ehr.latest_visit_number)}` : "Chưa có lần khám"}
        </span>
      </div>

      <div class="ehr-metric-row">
        ${ehrMetric("Khám gần nhất", formatDate(ehr?.latest_visit_date))}
        ${ehrMetric("Dị ứng", ehr?.has_allergy ? "Có" : "Chưa ghi nhận")}
        ${ehrMetric("Lối sống", lifestyleSummary(ehr))}
        ${ehrMetric("Sản phẩm liên quan", activeProducts.length)}
      </div>

      <div class="ehr-columns">
        <section>
          <h6>Bệnh lý / nguy cơ</h6>
          ${conditionNames.length ? tagList(conditionNames, "success") : '<div class="empty-state compact">Chưa có bệnh lý đã xác nhận.</div>'}
        </section>
        <section>
          <h6>Chỉ số gần nhất</h6>
          ${
            latestLabs.length
              ? latestLabs.map((item) => `<div class="ehr-line"><span>${escapeHtml(item.metric_name || item.metric_code)}</span><strong>${escapeHtml(metricValue(item))}</strong></div>`).join("")
              : '<div class="empty-state compact">Chưa có chỉ số xét nghiệm.</div>'
          }
        </section>
        <section>
          <h6>Kế hoạch chăm sóc</h6>
          ${activeProducts.length ? tagList(activeProducts.map((item) => item.product_name), "blue") : '<div class="empty-state compact">Chưa có sản phẩm đang dùng.</div>'}
        </section>
      </div>
    </section>
  `;
}

function ehrMetric(label, value) {
  return `
    <div class="ehr-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value ?? "-"))}</strong>
    </div>
  `;
}

function tagList(items, tone) {
  return `
    <div class="ehr-tag-list">
      ${items.map((item) => `<span class="badge ${tone || ""}">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function lifestyleSummary(ehr) {
  const parts = [ehr?.smoking, ehr?.alcohol, ehr?.exercise_frequency, ehr?.sleep_quality]
    .map((value) => lifestyleLabel(value))
    .filter(Boolean);
  return parts.length ? parts.slice(0, 2).join(" · ") : "Chưa ghi nhận";
}

function renderQualityNotice(status, stats) {
  if (status === "needs_review") {
    return `
      <div class="quality-notice warning">
        <strong>Cần rà soát dữ liệu</strong>
        <span>Số điện thoại hoặc định danh có khả năng trùng với hồ sơ khác. Cần kiểm tra có phải cùng một khách, người thân dùng chung số, hay dữ liệu nhập trùng.</span>
      </div>
    `;
  }
  if (status === "missing_contact") {
    return `
      <div class="quality-notice danger">
        <strong>Thiếu liên hệ</strong>
        <span>Hồ sơ chưa có số điện thoại hợp lệ nên khó định danh và chăm sóc tự động.</span>
      </div>
    `;
  }
  return "";
}

function renderProducts(items) {
  if (!items.length) return '<div class="empty-state compact">Chưa có dữ liệu sản phẩm.</div>';
  return `
    <div class="product-list">
      ${items
        .slice(0, 8)
        .map(
          (item) => `
            <article class="product-item">
              <div>
                <strong>${escapeHtml(item.product_name)}</strong>
                <p>${escapeHtml(item.evidence_text || productStatusLabel(item.usage_status))}</p>
              </div>
              <span class="badge ${productTone(item.usage_status)}">${escapeHtml(productStatusLabel(item.usage_status))}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderLabEntryForm(customerCode, metrics) {
  if (!metrics.length) return '<div class="empty-state compact">Chưa có chỉ số gợi ý để nhập.</div>';
  const defaultUnit = metrics[0]?.default_unit || "";
  const today = new Date().toISOString().slice(0, 10);
  return `
    <form class="lab-entry-form" data-lab-entry-form data-customer-code="${escapeHtml(customerCode)}">
      <label>
        Chỉ số
        <select name="metric_code" required>
          ${metrics
            .map(
              (item) => `
                <option value="${escapeHtml(item.metric_code)}" data-unit="${escapeHtml(item.default_unit || "")}">
                  ${escapeHtml(item.metric_name || item.metric_code)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>
      <div class="lab-entry-row">
        <label>
          Giá trị
          <input name="value" inputmode="decimal" placeholder="VD: 6.2" required />
        </label>
        <label>
          Đơn vị
          <input name="unit" value="${escapeHtml(defaultUnit)}" placeholder="%" />
        </label>
      </div>
      <label>
        Ngày đo
        <input name="measured_at" type="date" value="${escapeHtml(today)}" />
      </label>
      <label>
        Ghi chú
        <input name="notes" placeholder="VD: Nhập từ phiếu xét nghiệm ngày..." />
      </label>
      <button class="primary-button" type="submit">Lưu chỉ số</button>
    </form>
  `;
}

function renderConditions(items) {
  if (!items.length) return '<div class="empty-state compact">Chưa có dữ liệu đã xác nhận.</div>';
  return `
    <div class="health-list">
      ${items
        .map(
          (item) => `
            <article class="health-item">
              <div class="health-row">
                <strong>${escapeHtml(item.condition_name || item.condition_code)}</strong>
                <span class="badge success">${escapeHtml(conditionStatusLabel(item.current_status))}</span>
              </div>
              <p>${escapeHtml(item.notes || "Chưa có ghi chú xác nhận.")}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderLabResults(items) {
  if (!items.length) return '<div class="empty-state compact">Chưa có chỉ số đã xác nhận.</div>';
  return `
    <div class="health-list">
      ${items
        .map(
          (item) => `
            <article class="health-item">
              <div class="health-row">
                <strong>${escapeHtml(item.metric_name || item.metric_code)}</strong>
                <span>${escapeHtml(metricValue(item))}</span>
              </div>
              <p>${escapeHtml(formatDate(item.measured_at))}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderConditionCandidates(items) {
  if (!items.length) return '<div class="empty-state compact">Không có gợi ý.</div>';
  return `
    <div class="health-list">
      ${items
        .map(
          (item) => `
            <article class="health-item candidate">
              <div class="health-row">
                <strong>${escapeHtml(item.condition_name || item.condition_code)}</strong>
                <span>${escapeHtml(confidenceLabel(item.confidence_score))}</span>
              </div>
              <p>${escapeHtml(item.evidence_text || "")}</p>
              <div class="candidate-actions">
                <button class="small-button approve" type="button" data-action="approve" data-type="condition" data-id="${escapeHtml(item.id)}">Xác nhận</button>
                <button class="small-button reject" type="button" data-action="reject" data-type="condition" data-id="${escapeHtml(item.id)}">Bỏ qua</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderLabResultCandidates(items) {
  if (!items.length) return '<div class="empty-state compact">Không có gợi ý.</div>';
  return `
    <div class="health-list">
      ${items
        .map(
          (item) => `
            <article class="health-item candidate">
              <div class="health-row">
                <strong>${escapeHtml(item.metric_name || item.metric_code)}</strong>
                <span>${escapeHtml(metricValue(item))}</span>
              </div>
              <p>${escapeHtml(item.evidence_text || confidenceLabel(item.confidence_score))}</p>
              <div class="candidate-actions">
                <button class="small-button approve" type="button" data-action="approve" data-type="lab" data-id="${escapeHtml(item.id)}">Xác nhận</button>
                <button class="small-button reject" type="button" data-action="reject" data-type="lab" data-id="${escapeHtml(item.id)}">Bỏ qua</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRecommendedLabMetrics(items) {
  if (!items.length) return '<div class="empty-state compact">Chưa có gợi ý theo dõi.</div>';
  return `
    <div class="metric-chip-list">
      ${items
        .map(
          (item) => `
            <div class="metric-chip">
              <strong>${escapeHtml(item.metric_name || item.metric_code)}</strong>
              <span>${escapeHtml(item.default_unit || item.metric_group || "-")}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAudit(logs) {
  if (!logs.length) {
    els.auditList.innerHTML = '<div class="empty-state">Chưa có log.</div>';
    if (els.auditAdminList) els.auditAdminList.innerHTML = '<div class="empty-state">Chưa có log.</div>';
    return;
  }

  const html = logs
    .map(
      (log) => `
        <div class="audit-item">
          <span>${escapeHtml(log.action)} · ${escapeHtml(log.entity_type)}</span>
          <span>${formatDate(log.created_at)}</span>
        </div>
      `
    )
    .join("");
  els.auditList.innerHTML = html;
  if (els.auditAdminList) els.auditAdminList.innerHTML = html;
}

function renderRealtimeMonitor(payload) {
  const summary = payload?.summary || {};
  const events = payload?.events || [];
  const isHealthy = Number(summary.failed_open || 0) === 0 && Number(summary.needs_review_open || 0) === 0;

  els.monitoringLoaded.textContent = `Cập nhật ${formatDateTime(payload?.generated_at)} · ${events.length} event`;
  els.monitoringSummary.innerHTML = `
    ${monitoringCard("Trạng thái", isHealthy ? "Ổn định" : "Cần xử lý", isHealthy ? "success" : "danger", `Event cuối: ${formatDateTime(summary.last_event_at)}`)}
    ${monitoringCard("Event 24 giờ", summary.events_last_24h ?? 0, "blue", `${summary.processed_last_24h ?? 0} đã xử lý`)}
    ${monitoringCard("Lỗi đang mở", summary.failed_open ?? 0, Number(summary.failed_open || 0) ? "danger" : "success", "Cần xử lý ngay")}
    ${monitoringCard("Cần rà soát", summary.needs_review_open ?? 0, Number(summary.needs_review_open || 0) ? "warning" : "success", "Không tự hợp nhất")}
    ${monitoringCard("Đã bỏ qua 24 giờ", summary.ignored_last_24h ?? 0, "neutral", "Dữ liệu không áp dụng")}
    ${monitoringCard("Đơn đã xóa nguồn", summary.deleted_orders ?? 0, "neutral", "Vẫn giữ lịch sử")}
  `;

  if (!events.length) {
    els.monitoringList.innerHTML = '<div class="empty-state">Chưa có event realtime.</div>';
    return;
  }

  els.monitoringList.innerHTML = events.map((event) => `
    <article class="monitoring-event ${event.status === "failed" ? "has-error" : ""}">
      <div class="monitoring-event-main">
        <div>
          <div class="event-title">
            <strong>${escapeHtml(objectTypeLabel(event.object_type))}</strong>
            <span class="badge ${eventStatusTone(event.status)}">${escapeHtml(eventStatusLabel(event.status))}</span>
            ${event.order_deleted ? '<span class="badge danger">Đã xóa trên Pancake</span>' : ""}
          </div>
          <p>${escapeHtml(event.customer_name || event.customer_code || event.order_code || "Chưa liên kết hồ sơ")}</p>
        </div>
        <time>${escapeHtml(formatDateTime(event.received_at))}</time>
      </div>
      <div class="event-meta">
        <span>${escapeHtml(event.event_type || "-")}</span>
        <span>Shop ${escapeHtml(event.shop_id || "-")}</span>
        ${event.order_code ? `<span>Đơn ${escapeHtml(event.order_code)}</span>` : ""}
        ${event.error_message ? `<strong>${escapeHtml(event.error_message)}</strong>` : ""}
      </div>
    </article>
  `).join("");
}

function monitoringCard(label, value, tone, detail) {
  return `
    <article class="monitoring-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

function kv(label, value) {
  return `<div class="kv"><span>${escapeHtml(String(label))}</span><strong>${escapeHtml(String(value ?? "-"))}</strong></div>`;
}

function summaryItem(label, value) {
  return `<div class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? 0))}</strong></div>`;
}

function initials(name) {
  const parts = String(name || "DN").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "DN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function metricValue(item) {
  const value = item.value_numeric ?? item.value_text;
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${item.unit ? ` ${item.unit}` : ""}`;
}

function optionalNumber(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function optionalInteger(value) {
  const number = optionalNumber(value);
  return number === null ? null : Math.round(number);
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );
}

function parseMedicationLines(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, dosage, frequency, notes] = line.split("|").map((part) => (part || "").trim());
      return { medication_name: name, dosage, frequency, notes };
    })
    .filter((item) => item.medication_name);
}

function confidenceLabel(value) {
  if (value === null || value === undefined || value === "") return "Độ tin cậy -";
  return `Độ tin cậy ${Math.round(Number(value) * 100)}%`;
}

function genderLabel(value) {
  const labels = { female: "Nữ", male: "Nam", unknown: "Chưa rõ" };
  return labels[value] || value || "-";
}

function contactLabel(value) {
  const labels = { phone: "Điện thoại", email: "Email", facebook: "Facebook", zalo: "Zalo" };
  return labels[value] || value || "Liên hệ";
}

function matchReasonLabel(value) {
  const labels = {
    customer_code: "Mã khách",
    phone: "Số điện thoại",
    name: "Tên khách",
    pancake_psid: "Pancake PSID",
  };
  return labels[value] || value || "Khớp";
}

function duplicateTypeLabel(value) {
  const labels = {
    phone: "Trùng số điện thoại",
    pancake_psid: "Trùng Pancake PSID",
  };
  return labels[value] || value || "Trùng dữ liệu";
}

function duplicateReasonLabel(value) {
  const labels = {
    "Same normalized phone appears in multiple customer profiles": "Cùng một số điện thoại xuất hiện trong nhiều hồ sơ khách hàng.",
  };
  return labels[value] || value || "Cần kiểm tra lại dữ liệu định danh.";
}

function dataQualityLabel(value) {
  const labels = {
    clean: "Sạch",
    needs_review: "Cần rà soát",
    missing_contact: "Thiếu liên hệ",
  };
  return labels[value] || value || "-";
}

function conditionStatusLabel(value) {
  const labels = {
    confirmed: "Đã xác nhận",
    suspected: "Nghi ngờ",
    monitoring: "Theo dõi",
    controlled: "Ổn định",
    worsening: "Xấu đi",
    unknown: "Chưa rõ",
  };
  return labels[value] || value || "Chưa rõ";
}

function badgeTone(value) {
  if (value === "clean") return "success";
  if (value === "needs_review") return "warning";
  if (value === "missing_contact") return "danger";
  return "";
}

function productStatusLabel(value) {
  const labels = {
    using: "Đang dùng",
    interested: "Quan tâm",
    purchased: "Đã mua",
    stopped: "Đã dừng",
    unknown: "Chưa rõ",
  };
  return labels[value] || value || "Chưa rõ";
}

function productTone(value) {
  if (value === "using") return "success";
  if (value === "purchased") return "blue";
  if (value === "interested") return "warning";
  return "";
}

function lifestyleLabel(value) {
  const labels = {
    no: "Không",
    yes: "Có",
    never: "Không",
    former: "Đã từng",
    current: "Hiện có",
    occasional: "Thỉnh thoảng",
    regular: "Thường xuyên",
    none: "Ít vận động",
    "1_2_per_week": "1-2 lần/tuần",
    "1-2x_week": "1-2 lần/tuần",
    "3_5_per_week": "3-5 lần/tuần",
    "3-5x_week": "3-5 lần/tuần",
    daily: "Hằng ngày",
    good: "Ngủ tốt",
    fair: "Ngủ tạm",
    poor: "Ngủ kém",
    difficulty_falling: "Khó ngủ",
    waking_up: "Hay thức giấc",
    early_rising: "Dậy sớm",
    unknown: "",
  };
  return labels[value] ?? value ?? "";
}

function isAdminRole() {
  return ["owner", "manager"].includes(state.staff?.role);
}

function roleLabel(value) {
  const labels = {
    owner: "Owner",
    manager: "Manager",
    staff: "Nhân viên",
  };
  return labels[value] || "Nhân viên";
}

function mergeTableLabel(value) {
  const labels = {
    customer_identities: "Định danh",
    customer_contacts: "Liên hệ",
    customer_addresses: "Địa chỉ",
    customer_notes: "Ghi chú",
    customer_sources: "Nguồn dữ liệu",
    customer_condition_candidates: "Gợi ý bệnh lý",
    customer_conditions: "Bệnh lý xác nhận",
    customer_lab_result_candidates: "Gợi ý xét nghiệm",
    customer_lab_results: "Chỉ số xét nghiệm",
    customer_products: "Sản phẩm",
    orders: "Đơn hàng",
    integration_webhook_events: "Webhook event",
    raw_pancake_customer_rows: "Raw Pancake",
    ai_suggestions: "AI suggestion",
    audit_logs: "Audit log",
    customer_medical_history: "Tiền sử bệnh",
    customer_lifestyle: "Lối sống",
    customer_relationships: "Quan hệ người thân",
    consultation_visits: "Lần khám",
    consultation_vitals: "Sinh hiệu",
    consultation_medications: "Thuốc đang dùng",
    consultation_risk_assessment: "Đánh giá nguy cơ",
    consultation_treatment_plans: "Phác đồ",
    consultation_monitoring_targets: "Mục tiêu theo dõi",
    consultation_followups: "Lịch follow-up",
  };
  return labels[value] || value;
}

function objectTypeLabel(value) {
  const labels = {
    customer: "Khách hàng",
    order: "Đơn hàng",
    product: "Sản phẩm",
    unknown: "Chưa xác định",
  };
  return labels[value] || value || "Chưa xác định";
}

function eventStatusLabel(value) {
  const labels = {
    received: "Đã nhận",
    processed: "Đã xử lý",
    ignored: "Đã bỏ qua",
    needs_review: "Cần rà soát",
    failed: "Lỗi",
  };
  return labels[value] || value || "-";
}

function eventStatusTone(value) {
  if (value === "processed") return "success";
  if (value === "failed") return "danger";
  if (value === "needs_review") return "warning";
  if (value === "received") return "blue";
  return "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function runSearch() {
  const query = els.searchInput.value.trim();
  if (!query) return;
  setBusy(els.searchButton, true, "Đang tìm");
  try {
    const results = await searchCustomers(query);
    state.searchResults = results || [];
    state.searchPage = 1;
    rememberSearch(query);
    renderResults();
    await refreshAudit();
  } catch (error) {
    els.resultList.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
    if (els.resultPagination) els.resultPagination.hidden = true;
  } finally {
    setBusy(els.searchButton, false, "Tìm");
  }
}

function rememberSearch(query) {
  const normalized = String(query || "").trim();
  if (!normalized) return;
  state.recentSearches = [normalized, ...state.recentSearches.filter((item) => item !== normalized)].slice(0, 5);
  localStorage.setItem("drn_recent_searches", JSON.stringify(state.recentSearches));
  renderRecentSearches();
}

function renderRecentSearches() {
  if (!els.recentSearches) return;
  if (!state.accessToken || !state.recentSearches.length) {
    els.recentSearches.innerHTML = "";
    return;
  }

  els.recentSearches.innerHTML = `
    <span>Gần đây:</span>
    ${state.recentSearches
      .map((query) => `<button class="assist-chip recent" type="button" data-recent-search="${escapeHtml(query)}">${escapeHtml(query)}</button>`)
      .join("")}
  `;
}

function clearSearchState() {
  els.searchInput.value = "";
  state.searchResults = [];
  state.searchPage = 1;
  els.resultCount.textContent = "0";
  els.resultList.innerHTML = '<div class="empty-state">Nhập mã khách, số điện thoại hoặc tên để bắt đầu tra cứu.</div>';
  if (els.resultPagination) {
    els.resultPagination.innerHTML = "";
    els.resultPagination.hidden = true;
  }
}

async function loadDuplicateGroups() {
  if (!isAdminRole()) return;
  els.duplicateLoaded.textContent = "Đang tải";
  els.duplicateList.innerHTML = '<div class="empty-state">Đang tải danh sách rà soát.</div>';
  setBusy(els.refreshDuplicatesButton, true, "Đang tải");
  try {
    const payload = await getDuplicateReviewGroups();
    renderDuplicateGroups(payload);
  } catch (error) {
    els.duplicateList.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
    els.duplicateLoaded.textContent = "Không tải được";
  } finally {
    setBusy(els.refreshDuplicatesButton, false, "Tải lại");
  }
}

async function loadRealtimeMonitor() {
  if (!isAdminRole()) return;
  els.monitoringLoaded.textContent = "Đang tải";
  els.monitoringList.innerHTML = '<div class="empty-state">Đang tải dữ liệu giám sát.</div>';
  setBusy(els.refreshMonitoringButton, true, "Đang tải");
  try {
    const payload = await getRealtimeMonitor();
    renderRealtimeMonitor(payload);
    await refreshAudit();
  } catch (error) {
    els.monitoringList.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
    els.monitoringLoaded.textContent = "Không tải được";
  } finally {
    setBusy(els.refreshMonitoringButton, false, "Tải lại");
  }
}

async function openProfile(customerCode) {
  state.selectedCustomerCode = customerCode;
  els.profileStatus.textContent = "Đang tải";
  try {
    const profile = await getCustomerProfile(customerCode);
    let ehrSummary = null;
    if (profile?.found && profile.customer?.customer_code) {
      try {
        profile.contacts = await getCustomerContactsOperational(profile.customer.customer_code);
      } catch (error) {
        profile.contact_load_error = error.message || "Không tải được số điện thoại đầy đủ.";
      }
      try {
        ehrSummary = await getPatientRecordSummary(profile.customer.customer_code);
      } catch (error) {
        ehrSummary = { load_error: error.message || "Không tải được bệnh án điện tử." };
      }
    }
    renderProfile(profile, ehrSummary);
    document.querySelectorAll(".result-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.code === customerCode);
    });
    await refreshAudit();
  } catch (error) {
    els.profileContent.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
  }
}

async function handleRevealPhones(button) {
  if (!isAdminRole()) {
    window.alert("Chỉ owner/manager được hiện số điện thoại trong rà soát trùng.");
    return;
  }
  const candidateId = button.dataset.id;
  const phoneList = els.duplicateList.querySelector(`[data-phone-list="${CSS.escape(candidateId)}"]`);
  if (!candidateId || !phoneList) return;

  setBusy(button, true, "Đang hiện");
  try {
    const payload = await revealDuplicateGroupPhones(candidateId);
    phoneList.innerHTML = renderRevealedPhones(payload);
    phoneList.hidden = false;
    button.textContent = "Đã hiện số";
  } catch (error) {
    window.alert(error.message || "Không hiện được số điện thoại.");
    setBusy(button, false, "Hiện số điện thoại");
  }
}

function renderMergePreview(payload) {
  const counts = payload?.reference_counts || {};
  const countEntries = Object.entries(counts)
    .filter(([, value]) => Number(value || 0) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const primary = payload?.primary_customer || {};
  const secondaries = payload?.secondary_customers || [];
  const canMerge = Boolean(payload?.ready_to_merge);

  return `
    <div class="merge-preview-inner">
      <div class="merge-route">
        <div>
          <span>Giữ lại</span>
          <strong>${escapeHtml(primary.customer_code || "-")} · ${escapeHtml(primary.full_name || "Không tên")}</strong>
        </div>
        <div>
          <span>Gộp vào hồ sơ chính</span>
          <strong>${escapeHtml(secondaries.map((item) => item.customer_code).join(", ") || "-")}</strong>
        </div>
      </div>
      <div class="merge-impact-grid">
        ${
          countEntries.length
            ? countEntries.slice(0, 12).map(([key, value]) => kv(mergeTableLabel(key), value)).join("")
            : '<div class="empty-state compact">Không có dữ liệu phụ cần relink.</div>'
        }
      </div>
      <div class="merge-warning">
        <strong>${canMerge ? "Có thể merge sau khi đã backup" : "Tài khoản hiện tại không có quyền merge"}</strong>
        <span>Merge sẽ chuyển toàn bộ dữ liệu liên quan sang hồ sơ chính rồi xóa hồ sơ phụ. Đây là thao tác production data, cần backup trước.</span>
      </div>
      ${
        canMerge
          ? `<button class="small-button danger" type="button" data-action="merge-group" data-id="${escapeHtml(payload.candidate_id)}">Gộp hồ sơ này</button>`
          : ""
      }
    </div>
  `;
}

async function handlePreviewMerge(button) {
  if (!isAdminRole()) {
    window.alert("Chỉ owner/manager được xem tác động merge.");
    return;
  }
  const candidateId = button.dataset.id;
  const previewBox = els.duplicateList.querySelector(`[data-merge-preview="${CSS.escape(candidateId)}"]`);
  if (!candidateId || !previewBox) return;

  setBusy(button, true, "Đang xem");
  try {
    const payload = await previewCustomerMerge(candidateId);
    previewBox.innerHTML = renderMergePreview(payload);
    previewBox.hidden = false;
    button.textContent = "Đã xem tác động";
  } catch (error) {
    previewBox.innerHTML = `
      <div class="merge-warning danger">
        <strong>Chưa thể preview merge</strong>
        <span>${escapeHtml(error.message || "API preview chưa sẵn sàng. Không cho merge để tránh mất dữ liệu.")}</span>
      </div>
    `;
    previewBox.hidden = false;
    setBusy(button, false, "Xem tác động");
  }
}

async function handleMergeGroup(button) {
  if (!isAdminRole()) {
    window.alert("Chỉ owner/manager được gộp hồ sơ.");
    return;
  }
  const candidateId = button.dataset.id;
  if (!candidateId) return;

  const confirmed = window.confirm(
    "Gộp nhóm hồ sơ này vào hồ sơ chính? Chỉ làm khi backup production đã OK. Thao tác này sẽ xóa hồ sơ phụ sau khi relink dữ liệu."
  );
  if (!confirmed) return;

  setBusy(button, true, "Đang gộp");
  try {
    await mergeCustomerGroup(candidateId);
    await loadDuplicateGroups();
  } catch (error) {
    window.alert(error.message || "Không gộp được hồ sơ.");
    setBusy(button, false, "Gộp hồ sơ này");
  }
}

async function handleCandidateAction(button) {
  if (!isAdminRole()) {
    window.alert("Chỉ owner/manager được duyệt hoặc bỏ qua gợi ý sức khỏe.");
    return;
  }
  const { action, type, id } = button.dataset;
  if (!action || !type || !id) return;

  const isApprove = action === "approve";
  const noun = type === "condition" ? "gợi ý bệnh lý" : "gợi ý xét nghiệm";
  const confirmed = window.confirm(
    isApprove
      ? `Xác nhận ${noun} này thành dữ liệu chính thức?`
      : `Bỏ qua ${noun} này?`
  );
  if (!confirmed) return;

  const originalLabel = button.textContent;
  setBusy(button, true, "Đang xử lý");
  try {
    if (type === "condition" && isApprove) await approveConditionCandidate(id);
    if (type === "condition" && !isApprove) await rejectConditionCandidate(id, "Nhân viên bỏ qua trên dashboard.");
    if (type === "lab" && isApprove) await approveLabResultCandidate(id);
    if (type === "lab" && !isApprove) await rejectLabResultCandidate(id, "Nhân viên bỏ qua trên dashboard.");

    if (state.selectedCustomerCode) await openProfile(state.selectedCustomerCode);
  } catch (error) {
    window.alert(error.message || "Không xử lý được gợi ý.");
  } finally {
    setBusy(button, false, originalLabel);
  }
}

async function handleEditProfile(form) {
  const customerCode = form.dataset.customerCode;
  const submitBtn = form.querySelector('[type="submit"]');
  const data = new FormData(form);
  const fields = {};
  const fullName = (data.get("full_name") || "").trim();
  const gender = data.get("gender");
  const birthDate = (data.get("birth_date") || "").trim();
  if (fullName) fields.full_name = fullName;
  if (gender) fields.gender = gender;
  if (birthDate) fields.birth_date = birthDate;

  if (!Object.keys(fields).length) {
    window.alert("Không có thay đổi nào để lưu.");
    return;
  }

  setBusy(submitBtn, true, "Đang lưu…");
  try {
    await updateCustomerProfile(customerCode, fields);
    form.hidden = true;
    await openProfile(customerCode);
  } catch (err) {
    window.alert("Lỗi: " + (err.message || "Không thể cập nhật hồ sơ."));
  } finally {
    setBusy(submitBtn, false, "Lưu thay đổi");
  }
}

async function handleAddNote(form) {
  const customerCode = form.dataset.customerCode;
  const submitBtn = form.querySelector('[type="submit"]');
  const data = new FormData(form);
  const content = (data.get("content") || "").trim();
  const noteType = data.get("note_type");
  const sensitivityLevel = data.get("sensitivity_level");

  if (!content) {
    window.alert("Vui lòng nhập nội dung ghi chú.");
    return;
  }

  setBusy(submitBtn, true, "Đang lưu…");
  try {
    await addCustomerNote(customerCode, content, noteType, sensitivityLevel);
    form.reset();
    await openProfile(customerCode);
  } catch (err) {
    window.alert("Lỗi: " + (err.message || "Không thể thêm ghi chú."));
  } finally {
    setBusy(submitBtn, false, "Thêm ghi chú");
  }
}

async function handleLabEntrySubmit(form) {
  if (!isAdminRole()) {
    window.alert("Tài khoản nhân viên không có quyền nhập kết quả xét nghiệm confirmed.");
    return;
  }
  const data = new FormData(form);
  const rawValue = String(data.get("value") || "").trim().replace(",", ".");
  const numericValue = rawValue !== "" && !Number.isNaN(Number(rawValue)) ? Number(rawValue) : null;
  const textValue = numericValue === null ? rawValue : null;
  const payload = {
    customer_ref: form.dataset.customerCode,
    metric_code: data.get("metric_code"),
    value_numeric: numericValue,
    value_text: textValue,
    unit: String(data.get("unit") || "").trim() || null,
    measured_at: data.get("measured_at") || null,
    notes: String(data.get("notes") || "").trim() || "Nhập thủ công từ dashboard.",
  };

  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, "Đang lưu");
  try {
    await createLabResult(payload);
    if (state.selectedCustomerCode) await openProfile(state.selectedCustomerCode);
  } catch (error) {
    window.alert(error.message || "Không lưu được chỉ số.");
  } finally {
    setBusy(button, false, "Lưu chỉ số");
  }
}

async function handleConsultationSubmit(form) {
  const data = new FormData(form);
  const customerId = form.dataset.customerId;
  const customerCode = form.dataset.customerCode;
  const button = form.querySelector('button[type="submit"]');

  if (!customerId) {
    window.alert("Thiếu mã hồ sơ khách hàng, vui lòng tải lại hồ sơ.");
    return;
  }

  const visitPayload = compactPayload({
    customer_id: customerId,
    visit_date: data.get("visit_date") || new Date().toISOString().slice(0, 10),
    consultation_reasons: data.get("consultation_reason") ? [data.get("consultation_reason")] : [],
    symptom_description: String(data.get("symptom_description") || "").trim(),
    onset_duration: data.get("onset_duration") || null,
    current_symptoms: splitList(data.get("current_symptoms")),
    symptom_severity: data.get("symptom_severity") || null,
    primary_diagnosis: String(data.get("primary_diagnosis") || "").trim(),
    notes: String(data.get("notes") || "").trim(),
  });

  const vitalsPayload = compactPayload({
    height_cm: optionalNumber(data.get("height_cm")),
    weight_kg: optionalNumber(data.get("weight_kg")),
    waist_cm: optionalNumber(data.get("waist_cm")),
    blood_pressure_systolic: optionalInteger(data.get("blood_pressure_systolic")),
    blood_pressure_diastolic: optionalInteger(data.get("blood_pressure_diastolic")),
    pulse_bpm: optionalInteger(data.get("pulse_bpm")),
    spo2_percent: optionalNumber(data.get("spo2_percent")),
    blood_glucose_mmol: optionalNumber(data.get("blood_glucose_mmol")),
  });

  const medications = parseMedicationLines(data.get("medications"));
  const followupType = data.get("followup_type");
  const followupPayload = compactPayload({
    followup_type: followupType || null,
    scheduled_date: data.get("followup_date") || null,
    notes: String(data.get("followup_notes") || "").trim(),
  });

  setBusy(button, true, "Đang lưu");
  try {
    const visits = await createConsultationVisit(visitPayload);
    const visit = visits?.[0];
    if (!visit?.id) throw new Error("Không nhận được mã lần khám sau khi lưu.");

    if (Object.keys(vitalsPayload).length) {
      await createConsultationVitals({ ...vitalsPayload, visit_id: visit.id, customer_id: customerId });
    }

    for (const medication of medications) {
      await createConsultationMedication(compactPayload({ ...medication, visit_id: visit.id, customer_id: customerId }));
    }

    if (followupPayload.followup_type) {
      await createConsultationFollowup({ ...followupPayload, visit_id: visit.id, customer_id: customerId });
    }

    form.reset();
    await openProfile(customerCode);
    window.alert(`Đã lưu phiếu khám #${visit.visit_number || ""}.`);
  } catch (error) {
    window.alert(error.message || "Không lưu được phiếu khám.");
  } finally {
    setBusy(button, false, "Lưu phiếu khám");
  }
}

async function handleDismissGroup(button) {
  if (!isAdminRole()) {
    window.alert("Chỉ owner/manager được xử lý nhóm hồ sơ trùng.");
    return;
  }
  const candidateId = button.dataset.id;
  if (!candidateId) return;
  const confirmed = window.confirm("Đánh dấu nhóm này không phải trùng? Hành động này sẽ ghi audit log.");
  if (!confirmed) return;
  setBusy(button, true, "Đang xử lý");
  try {
    await dismissDuplicateGroup(candidateId);
    const card = button.closest(".duplicate-group");
    if (card) card.remove();
    const remaining = els.duplicateList.querySelectorAll(".duplicate-group").length;
    if (remaining === 0) {
      els.duplicateList.innerHTML = '<div class="empty-state">Không còn nhóm nào cần rà soát.</div>';
    }
    const currentTotal = parseInt(els.duplicateTotal.textContent, 10);
    if (!Number.isNaN(currentTotal) && currentTotal > 0) {
      els.duplicateTotal.textContent = String(currentTotal - 1);
    }
  } catch (error) {
    window.alert(error.message || "Không thể bỏ qua nhóm này.");
    setBusy(button, false, "Không phải trùng");
  }
}

function renderReviewQueue(payload, filter) {
  const conditions = payload?.condition_candidates || [];
  const labResults = payload?.lab_result_candidates || [];
  const total = payload?.total_pending ?? 0;

  els.reviewQueueTotal.textContent = String(total);
  if (els.reviewQueueBadge) {
    els.reviewQueueBadge.textContent = total > 0 ? String(total) : "";
    els.reviewQueueBadge.hidden = total === 0;
  }

  const items = [
    ...conditions.map((c) => ({ ...c, _type: "condition" })),
    ...labResults.map((l) => ({ ...l, _type: "lab" })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!items.length) {
    els.reviewQueueList.innerHTML = '<div class="empty-state">Không có gợi ý nào đang chờ review.</div>';
    return;
  }

  els.reviewQueueList.innerHTML = items
    .map(
      (item) => `
        <article class="review-queue-item">
          <div class="review-queue-item-header">
            <span class="badge ${item._type === "condition" ? "info" : "warning"}">${item._type === "condition" ? "Bệnh lý" : "Xét nghiệm"}</span>
            <span class="review-queue-customer">
              <strong>${escapeHtml(item.customer_name || "Không tên")}</strong>
              <span>${escapeHtml(item.customer_code)}</span>
            </span>
            <button class="small-button" type="button" data-action="open-customer" data-code="${escapeHtml(item.customer_code)}">Mở hồ sơ</button>
          </div>
          <div class="kv-list">
            ${item._type === "condition"
              ? `${kv("Mã bệnh lý", item.condition_code)} ${kv("Trạng thái gợi ý", item.condition_status)}`
              : `${kv("Chỉ số", item.metric_code)} ${kv("Giá trị", `${item.value ?? "-"} ${item.unit || ""}`)} ${kv("Ngày XN", formatDate(item.tested_at))}`
            }
            ${kv("Độ tin cậy", confidenceLabel(item.confidence_score))}
            ${kv("Nguồn", item.source_type || "-")}
            ${kv("Tạo lúc", formatDateTime(item.created_at))}
          </div>
          ${item.extraction_notes ? `<p class="extraction-notes">${escapeHtml(item.extraction_notes)}</p>` : ""}
        </article>
      `
    )
    .join("");
}

async function loadReviewQueue(filter) {
  if (!isAdminRole()) return;
  const activeFilter = filter || state.reviewQueueFilter || "all";
  state.reviewQueueFilter = activeFilter;
  els.reviewQueueLoaded.textContent = "Đang tải";
  els.reviewQueueList.innerHTML = '<div class="empty-state">Đang tải danh sách.</div>';
  if (els.refreshReviewQueueButton) setBusy(els.refreshReviewQueueButton, true, "Đang tải");
  try {
    const payload = await listPendingHealthCandidates(activeFilter, 100);
    renderReviewQueue(payload, activeFilter);
    els.reviewQueueLoaded.textContent = `Tải lúc ${new Date().toLocaleTimeString("vi-VN")}`;
  } catch (error) {
    els.reviewQueueList.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
    els.reviewQueueLoaded.textContent = "Không tải được";
  } finally {
    if (els.refreshReviewQueueButton) setBusy(els.refreshReviewQueueButton, false, "Tải lại");
  }
}

async function refreshAudit() {
  if (!isAdminRole()) {
    els.auditList.innerHTML = "";
    if (els.auditAdminList) els.auditAdminList.innerHTML = "";
    return;
  }
  try {
    const logs = await getAuditLogs();
    renderAudit(logs);
  } catch (error) {
    els.auditList.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
    if (els.auditAdminList) els.auditAdminList.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
  }
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  setBusy(event.submitter, true, "Đang đăng nhập");
  try {
    await signIn(els.emailInput.value.trim(), els.passwordInput.value);
    const staff = await getStaffContext();
    saveStaffContext(staff);
    els.passwordInput.value = "";
    renderSession();
    await refreshAudit();
  } catch (error) {
    showError(error.message);
  } finally {
    setBusy(event.submitter, false, "Đăng nhập");
  }
});

els.signOutButton.addEventListener("click", () => {
  clearSession();
  renderSession();
  els.resultList.innerHTML = "";
  if (els.resultPagination) {
    els.resultPagination.innerHTML = "";
    els.resultPagination.hidden = true;
  }
  els.profileContent.innerHTML = '<div class="empty-state">Chọn một khách hàng để xem hồ sơ.</div>';
  els.duplicateList.innerHTML = "";
  els.duplicateTotal.textContent = "0";
  els.duplicateLoaded.textContent = "Chưa tải";
  els.monitoringSummary.innerHTML = "";
  els.monitoringList.innerHTML = "";
  els.monitoringLoaded.textContent = "Chưa tải";
  els.auditList.innerHTML = "";
  if (els.auditAdminList) els.auditAdminList.innerHTML = "";
  state.aiChatHistory = [];
  state.aiContext = null;
  updateAiContextChip();
  renderAiChatHistory();
});

els.navCustomers.addEventListener("click", () => {
  switchView("customers");
});

els.navDuplicates.addEventListener("click", () => {
  switchView("duplicates");
});

els.navMonitoring.addEventListener("click", () => {
  switchView("monitoring");
});

els.searchButton.addEventListener("click", runSearch);
els.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});
els.searchClearButton.addEventListener("click", clearSearchState);

document.querySelectorAll("[data-search-example]").forEach((button) => {
  button.addEventListener("click", () => {
    els.searchInput.value = button.dataset.searchExample || "";
    els.searchInput.focus();
  });
});

els.recentSearches.addEventListener("click", (event) => {
  const button = event.target.closest("[data-recent-search]");
  if (!button) return;
  els.searchInput.value = button.dataset.recentSearch || "";
  runSearch();
});

if (els.resultPagination) {
  els.resultPagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    state.searchPage = Number(button.dataset.page) || 1;
    renderResults();
  });
}

els.resultList.addEventListener("click", (event) => {
  const button = event.target.closest(".result-button");
  if (button) openProfile(button.dataset.code);
});

els.profileContent.addEventListener("click", (event) => {
  const profileTab = event.target.closest("[data-profile-tab]");
  if (profileTab) {
    state.profileTab = profileTab.dataset.profileTab || "overview";
    if (state.currentProfile) renderProfile(state.currentProfile, state.currentEhrSummary);
    return;
  }

  const printButton = event.target.closest('[data-action="print-profile"], [data-action="print-consultation"]');
  if (printButton) {
    window.print();
    return;
  }

  const aiButton = event.target.closest('[data-action="open-ai-for-customer"]');
  if (aiButton) {
    state.aiContext = { code: aiButton.dataset.code, name: aiButton.dataset.name || aiButton.dataset.code };
    updateAiContextChip();
    switchView("ai-chat");
    return;
  }

  const candidateBtn = event.target.closest("[data-action][data-type][data-id]");
  if (candidateBtn) { handleCandidateAction(candidateBtn); return; }

  const toggleEdit = event.target.closest('[data-action="toggle-edit-profile"]');
  if (toggleEdit) {
    const form = els.profileContent.querySelector("[data-edit-profile-form]");
    if (form) form.hidden = !form.hidden;
  }
});

els.profileContent.addEventListener("change", (event) => {
  const select = event.target.closest('[data-lab-entry-form] select[name="metric_code"]');
  if (!select) return;
  const unitInput = select.form.querySelector('input[name="unit"]');
  const selected = select.options[select.selectedIndex];
  if (unitInput && !unitInput.value) unitInput.value = selected.dataset.unit || "";
});

els.profileContent.addEventListener("submit", (event) => {
  if (event.target.closest("[data-lab-entry-form]")) {
    event.preventDefault();
    handleLabEntrySubmit(event.target.closest("[data-lab-entry-form]"));
    return;
  }
  if (event.target.closest("[data-consultation-form]")) {
    event.preventDefault();
    handleConsultationSubmit(event.target.closest("[data-consultation-form]"));
    return;
  }
  if (event.target.closest("[data-edit-profile-form]")) {
    event.preventDefault();
    handleEditProfile(event.target.closest("[data-edit-profile-form]"));
    return;
  }
  if (event.target.closest("[data-add-note-form]")) {
    event.preventDefault();
    handleAddNote(event.target.closest("[data-add-note-form]"));
  }
});

els.refreshAuditButton.addEventListener("click", refreshAudit);
if (els.refreshAuditAdminButton) els.refreshAuditAdminButton.addEventListener("click", refreshAudit);
els.refreshDuplicatesButton.addEventListener("click", loadDuplicateGroups);
els.refreshMonitoringButton.addEventListener("click", loadRealtimeMonitor);

els.duplicateList.addEventListener("click", async (event) => {
  const revealButton = event.target.closest('[data-action="reveal-phones"]');
  if (revealButton) {
    await handleRevealPhones(revealButton);
    return;
  }

  const previewButton = event.target.closest('[data-action="preview-merge"]');
  if (previewButton) {
    await handlePreviewMerge(previewButton);
    return;
  }

  const mergeButton = event.target.closest('[data-action="merge-group"]');
  if (mergeButton) {
    await handleMergeGroup(mergeButton);
    return;
  }

  const dismissButton = event.target.closest('[data-action="dismiss-group"]');
  if (dismissButton) {
    await handleDismissGroup(dismissButton);
    return;
  }

  const openButton = event.target.closest('[data-action="open-customer"]');
  if (openButton) {
    await switchView("customers");
    await openProfile(openButton.dataset.code);
  }
});

els.navReviewQueue.addEventListener("click", () => switchView("review-queue"));
els.refreshReviewQueueButton.addEventListener("click", () => loadReviewQueue(state.reviewQueueFilter));

[els.filterAll, els.filterCondition, els.filterLab].forEach((btn) => {
  btn.addEventListener("click", () => {
    [els.filterAll, els.filterCondition, els.filterLab].forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    loadReviewQueue(btn.dataset.filter);
  });
});

els.reviewQueueList.addEventListener("click", async (event) => {
  const openButton = event.target.closest('[data-action="open-customer"]');
  if (openButton) {
    await switchView("customers");
    await openProfile(openButton.dataset.code);
  }
});

// ============================================================
// AI CHAT
// ============================================================

const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Current customer context persisted across messages
// { code: string, name: string } | null
state.aiContext = null;

function updateAiContextChip() {
  const chip = document.getElementById("aiContextChip");
  const nameEl = document.getElementById("aiContextName");
  if (!chip || !nameEl) return;
  if (state.aiContext) {
    nameEl.textContent = state.aiContext.name || state.aiContext.code;
    chip.hidden = false;
  } else {
    chip.hidden = true;
  }
}

function renderAiChatHistory() {
  if (!state.aiChatHistory.length) {
    els.aiChatMessages.innerHTML = `
      <div class="ai-chat-welcome">
        <p>✦ Hỏi về khách hàng bằng tên, số điện thoại, hoặc mã khách hàng.<br/>AI sẽ tự tra cứu và trả lời.</p>
      </div>`;
    return;
  }
  els.aiChatMessages.innerHTML = state.aiChatHistory
    .map((msg) => {
      if (msg.role === "user") {
        return `<div class="ai-msg ai-msg-user"><p>${escapeHtml(msg.content)}</p></div>`;
      }
      if (msg.type === "selection") {
        // Render customer selection cards
        const cards = (msg.candidates || []).map((c) => {
          const phone = c.masked_primary_phone ? `· ${escapeHtml(c.masked_primary_phone)}` : "";
          const spent = c.total_spent_vnd
            ? `· ${Number(c.total_spent_vnd).toLocaleString("vi-VN")}₫`
            : "";
          return `<button class="ai-selection-card" type="button"
            data-code="${escapeHtml(c.customer_code)}"
            data-name="${escapeHtml(c.full_name || "")}"
            data-question="${escapeHtml(msg.question || "")}">
            <strong>${escapeHtml(c.full_name || c.customer_code)}</strong>
            <span>${escapeHtml(c.customer_code)} ${phone} ${spent}</span>
          </button>`;
        }).join("");
        return `<div class="ai-msg ai-msg-assistant">
          <p>Tìm thấy <strong>${msg.candidates.length}</strong> khách hàng khớp "<em>${escapeHtml(msg.search_term || "")}</em>". Chọn khách muốn xem:</p>
          <div class="ai-selection-list">${cards}</div>
        </div>`;
      }
      // Normal assistant message
      const contextTag = msg.customer_name
        ? `<span class="ai-msg-context">Khách: ${escapeHtml(msg.customer_name)}${msg.customer_code ? ` (${escapeHtml(msg.customer_code)})` : ""}</span>`
        : "";
      const sourceTag = msg.sources?.length
        ? `<span class="ai-msg-sources">Nguồn: ${msg.sources.map((source) => escapeHtml(source)).join(", ")}</span>`
        : "";
      const formattedContent = escapeHtml(msg.content).replace(/\n/g, "<br>");
      return `<div class="ai-msg ai-msg-assistant">${contextTag}<p>${formattedContent}</p>${sourceTag}</div>`;
    })
    .join("");

  // Bind selection card clicks
  els.aiChatMessages.querySelectorAll(".ai-selection-card").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.dataset.code;
      const name = btn.dataset.name;
      const originalQuestion = btn.dataset.question;
      if (code && originalQuestion && !state.aiChatPending) {
        state.aiContext = { code, name };
        updateAiContextChip();
        await sendAiChatMessage(originalQuestion, code);
      }
    });
  });

  els.aiChatMessages.scrollTop = els.aiChatMessages.scrollHeight;
}

function appendAiTyping() {
  const el = document.createElement("div");
  el.className = "ai-msg ai-msg-assistant ai-msg-typing";
  el.id = "aiTypingIndicator";
  el.innerHTML = `<span></span><span></span><span></span>`;
  els.aiChatMessages.appendChild(el);
  els.aiChatMessages.scrollTop = els.aiChatMessages.scrollHeight;
}

function removeAiTyping() {
  document.getElementById("aiTypingIndicator")?.remove();
}

// Build conversation history for LLM (exclude current question, selection messages, limit to 20)
function buildAiHistory() {
  const result = [];
  for (const msg of state.aiChatHistory) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant" && msg.content && msg.type !== "selection") {
      result.push({ role: "assistant", content: msg.content });
    }
  }
  return result.slice(-20);
}

function aiErrorMessage(errorCode, status) {
  const messages = {
    unauthorized: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
    active_staff_required: "Tài khoản chưa được cấp quyền nhân viên đang hoạt động.",
    rate_limit_exceeded: "Đã vượt giới hạn AI Chat. Thử lại sau một phút.",
    question_too_long: "Câu hỏi quá dài.",
    invalid_history: "Lịch sử hội thoại không hợp lệ.",
    history_too_long: "Hội thoại quá dài. Hãy xóa hội thoại và thử lại.",
    invalid_scopes: "Phạm vi dữ liệu yêu cầu không hợp lệ.",
    server_configuration_error: "AI Chat chưa được cấu hình đầy đủ.",
    rate_limit_check_failed: "Không kiểm tra được hạn mức AI Chat.",
    ai_chat_failed: "AI Chat gặp lỗi khi xử lý câu hỏi.",
  };
  return messages[errorCode] || `AI Chat không phản hồi được${status ? ` (HTTP ${status})` : ""}.`;
}

function aiRequestErrorMessage(error) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Không gọi được AI Chat. Khả năng cao là CORS/Edge Function production chưa khớp với dashboard hiện tại.";
  }
  return error?.message || "AI Chat không phản hồi được.";
}

async function sendAiChatMessage(question, selectedCustomerCode = null, customScopes = null) {
  if (state.aiChatPending) return;
  const requestAccessToken = state.accessToken;
  if (!requestAccessToken) {
    state.aiChatHistory.push({
      role: "assistant",
      content: "Vui lòng đăng nhập lại trước khi dùng AI Chat.",
    });
    renderAiChatHistory();
    return;
  }

  state.aiChatPending = true;
  const requestId = state.aiChatRequestId + 1;
  state.aiChatRequestId = requestId;

  // Build history BEFORE pushing current question (so current Q is not duplicated)
  const history = buildAiHistory();
  if (
    selectedCustomerCode
    && history.at(-1)?.role === "user"
    && history.at(-1)?.content === question
  ) {
    history.pop();
  }

  // selectedCustomerCode = user clicked a card (don't duplicate the user message)
  if (!selectedCustomerCode) {
    state.aiChatHistory.push({ role: "user", content: question });
    renderAiChatHistory();
  }
  appendAiTyping();
  setBusy(els.aiChatSend, true, "…");

  try {
    const body = {
      question,
      history,
      scopes: customScopes || ["profile", "purchase_history", "notes", "products"],
    };
    if (selectedCustomerCode) {
      body.selected_customer_code = selectedCustomerCode;
    } else if (state.aiContext?.code) {
      body.context_customer_code = state.aiContext.code;
    }

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requestAccessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (requestId !== state.aiChatRequestId || requestAccessToken !== state.accessToken) return;

    if (!response.ok || data.error) {
      throw new Error(aiErrorMessage(data.error, response.status));
    }

    if (data.type === "selection_needed") {
      // Multiple customers found — let user choose
      state.aiChatHistory.push({
        role: "assistant",
        type: "selection",
        candidates: data.candidates,
        search_term: data.search_term,
        question: data.question,
      });
    } else if (data.type === "customer_not_found") {
      state.aiContext = null;
      updateAiContextChip();
      state.aiChatHistory.push({
        role: "assistant",
        content: data.search_term
          ? `Không tìm thấy khách hàng khớp "${data.search_term}".`
          : "Không tìm thấy khách hàng đã chọn.",
      });
    } else {
      // Normal answer
      if (data.customer_code) {
        state.aiContext = { code: data.customer_code, name: data.customer_name || data.customer_code };
        updateAiContextChip();
      }
      state.aiChatHistory.push({
        role: "assistant",
        content: data.answer,
        customer_code: data.customer_code,
        customer_name: data.customer_name,
        sources: data.sources || [],
      });
    }
  } catch (err) {
    if (requestId !== state.aiChatRequestId || requestAccessToken !== state.accessToken) return;
    state.aiChatHistory.push({
      role: "assistant",
      content: `⚠ Lỗi: ${aiRequestErrorMessage(err)}`,
    });
  } finally {
    if (requestId === state.aiChatRequestId) {
      state.aiChatPending = false;
      removeAiTyping();
      renderAiChatHistory();
      setBusy(els.aiChatSend, false, "Gửi");
    }
  }
}

// Nav
els.navAiChat.addEventListener("click", () => switchView("ai-chat"));

// Clear context chip
document.getElementById("aiClearContext")?.addEventListener("click", () => {
  state.aiContext = null;
  updateAiContextChip();
});

// Clear chat
els.aiClearChat.addEventListener("click", () => {
  state.aiChatRequestId += 1;
  state.aiChatPending = false;
  state.aiChatHistory = [];
  state.aiContext = null;
  updateAiContextChip();
  removeAiTyping();
  setBusy(els.aiChatSend, false, "Gửi");
  renderAiChatHistory();
});

// Submit via form
els.aiChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = els.aiChatInput.value.trim();
  if (!question) return;
  els.aiChatInput.value = "";
  els.aiChatInput.style.height = "auto";
  await sendAiChatMessage(question);
});

// Enter gửi, Shift+Enter xuống dòng
els.aiChatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.aiChatForm.requestSubmit();
  }
});

// Auto-resize textarea
els.aiChatInput.addEventListener("input", () => {
  els.aiChatInput.style.height = "auto";
  els.aiChatInput.style.height = `${Math.min(els.aiChatInput.scrollHeight, 160)}px`;
});

async function bootstrapSession() {
  if (state.accessToken && !state.staff) {
    try {
      saveStaffContext(await getStaffContext());
    } catch (error) {
      clearSession();
    }
  }
  renderSession();
  if (state.accessToken) refreshAudit();
}

bootstrapSession();
