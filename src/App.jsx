import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";

/* ── Environment ─────────────────────────────────────────────── */
const CLIENT_ID       = import.meta.env.VITE_CLIENT_ID;
const CLIENT_SECRET   = import.meta.env.VITE_CLIENT_SECRET;
const TOKEN_URL       = import.meta.env.VITE_TOKEN_URL;
const API_BASE        = import.meta.env.VITE_API_BASE;
const ASSIGN_BASE     = import.meta.env.VITE_ASSIGNMENT_API_BASE;
const DEFAULT_CASE_ID = import.meta.env.VITE_CASE_ID || "OCW5DK-GENAI-WORK I-3004";

/* ── Helpers ─────────────────────────────────────────────────── */
const encodeId = (id) => encodeURIComponent(id);

const statusClass = (s = "") => {
  if (s === "NIGO") return "nigo";
  if (s === "IGO")  return "igo";
  return "ordered";
};

const statusIcon = (s = "") => {
  if (s === "NIGO")       return "⚠";
  if (s === "IGO")        return "✓";
  if (s === "Ordered")    return "⏳";
  if (s === "Re-Ordered") return "🔄";
  return "•";
};

/* Helper to safely retrieve field config from uiResources */
const getFieldMeta = (uiResources, fieldId) => {
  const fields = uiResources?.fields || {};
  return fields[fieldId]?.[0] || {};
};

const getFieldLabel = (uiResources, fieldId, fallback) => {
  const meta = getFieldMeta(uiResources, fieldId);
  return meta.label || fallback;
};

const getFieldOptions = (uiResources, fieldId, fallbackList = []) => {
  const meta = getFieldMeta(uiResources, fieldId);
  const records = meta.datasource?.records;
  if (records && Array.isArray(records)) {
    return records.map((r) => r.value || r.key);
  }
  return fallbackList;
};

/* ── Toast component ─────────────────────────────────────────── */
function Toast({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => onRemove(t.id)} style={{ cursor: "pointer" }}>
          <span className="toast-icon">
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
          </span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ── Stages Bar ──────────────────────────────────────────────── */
function StagesBar({ stages = [] }) {
  if (!stages.length) return null;
  return (
    <div className="stages-bar">
      {stages.map((s, i) => (
        <div key={s.ID} className={`stage-item ${s.visited_status}`}>
          {i > 0 && null /* connector handled by CSS ::before */}
          <div className={`stage-dot ${s.visited_status}`}>
            {s.visited_status === "completed" ? "✓" : i + 1}
          </div>
          <span className="stage-label">{s.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Requirements Table (CollectAdditionalRequirements view) ─── */
function CollectReqTable({ rows, onFileSelect, uploading, uiResources }) {
  const requirementLabel = getFieldLabel(uiResources, "Requirement", "Requirement");
  const detailLabel = getFieldLabel(uiResources, "Detail", "Detail");
  const levelLabel = getFieldLabel(uiResources, "Level", "Level");
  const typeLabel = getFieldLabel(uiResources, "RequirementType", "Type");
  const statusLabel = getFieldLabel(uiResources, "Status", "Status");
  const attachmentLabel = getFieldLabel(uiResources, "RequiredAttachment", "Attachment");

  return (
    <div className="req-table-wrapper">
      <table className="req-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{requirementLabel}</th>
            <th>{detailLabel}</th>
            <th>{levelLabel}</th>
            <th>{typeLabel}</th>
            <th>{statusLabel}</th>
            <th>{attachmentLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="fade-in">
              <td>{i + 1}</td>
              <td style={{ fontWeight: 500 }}>{row.Requirement || "—"}</td>
              <td>{row.Detail || "—"}</td>
              <td>{row.Level || "—"}</td>
              <td>{row.RequirementType || "—"}</td>
              <td>
                <span className={`status-pill ${statusClass(row.Status)}`}>
                  {statusIcon(row.Status)} {row.Status || "—"}
                </span>
              </td>
              <td>
                <AttachCell
                  rowIndex={i}
                  file={row._file}
                  attachmentId={row._attachmentId}
                  isUploading={uploading[i]}
                  onSelect={onFileSelect}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Review Attached Documents Table (read-only + editable dropdowns) */
function ReviewReqTable({ rows, onRowChange, uiResources }) {
  const statusOptions = getFieldOptions(uiResources, "Status", ["IGO", "NIGO", "Ordered", "Re-Ordered"]);
  const typeOptions   = getFieldOptions(uiResources, "RequirementType", ["External", "Internal"]);
  const levelOptions  = getFieldOptions(uiResources, "Level", ["Beneficiary", "Claim"]);

  const requirementLabel = getFieldLabel(uiResources, "Requirement", "Requirement");
  const detailLabel = getFieldLabel(uiResources, "Detail", "Detail");
  const levelLabel = getFieldLabel(uiResources, "Level", "Level");
  const typeLabel = getFieldLabel(uiResources, "RequirementType", "Type");
  const statusLabel = getFieldLabel(uiResources, "Status", "Status");
  const attachmentLabel = getFieldLabel(uiResources, "RequiredAttachment", "Attachment");

  return (
    <div className="req-table-wrapper">
      <table className="req-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{requirementLabel}</th>
            <th>{detailLabel}</th>
            <th>{levelLabel}</th>
            <th>{typeLabel}</th>
            <th>{statusLabel}</th>
            <th>{attachmentLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="fade-in">
              <td>{i + 1}</td>
              <td>
                <input
                  type="text"
                  value={row.Requirement || ""}
                  onChange={(e) => onRowChange(i, "Requirement", e.target.value)}
                  style={{ minWidth: 130 }}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={row.Detail || ""}
                  onChange={(e) => onRowChange(i, "Detail", e.target.value)}
                  style={{ minWidth: 120 }}
                />
              </td>
              <td>
                <select value={row.Level || ""} onChange={(e) => onRowChange(i, "Level", e.target.value)}>
                  <option value="">Select…</option>
                  {levelOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </td>
              <td>
                <select value={row.RequirementType || ""} onChange={(e) => onRowChange(i, "RequirementType", e.target.value)}>
                  <option value="">Select…</option>
                  {typeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </td>
              <td>
                <select value={row.Status || ""} onChange={(e) => onRowChange(i, "Status", e.target.value)}>
                  <option value="">Select…</option>
                  {statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </td>
              <td>
                {row.RequiredAttachment?.pyAttachName ? (
                  <div className="file-chip">
                    <span></span>
                    <span className="file-chip-name" title={row.RequiredAttachment.pyAttachName}>
                      {row.RequiredAttachment.pyAttachName}
                    </span>
                  </div>
                ) : (
                  <span style={{ color: "var(--text-subtle)", fontSize: 12 }}>No attachment</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Attachment Cell ─────────────────────────────────────────── */
function AttachCell({ rowIndex, file, attachmentId, isUploading, onSelect }) {
  const inputRef = useRef(null);

  return (
    <div className="attach-cell">
      {isUploading ? (
        <div className="upload-indicator">
          <div className="upload-spinner" />
          Uploading…
        </div>
      ) : attachmentId ? (
        <div className="file-chip">
          <span></span>
          <span className="file-chip-name" title={file?.name}>{file?.name}</span>
          <span
            className="file-chip-remove"
            onClick={() => onSelect(rowIndex, null)}
            title="Remove"
          >×</span>
        </div>
      ) : (
        <label className="attach-btn">
          <span> Upload</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && onSelect(rowIndex, e.target.files[0])}
          />
        </label>
      )}
    </div>
  );
}

/* ── Main App ────────────────────────────────────────────────── */
export default function App() {
  /* Step machine:
     LOADING → COLLECT_REQ → REVIEW_DOCS → SUCCESS */
  const [step,            setStep]            = useState("LOADING");
  const [loadingMsg,      setLoadingMsg]       = useState("Authenticating…");
  const [error,           setError]            = useState("");
  const [toasts,          setToasts]           = useState([]);

  /* auth */
  const [token,           setToken]            = useState("");

  /* case */
  const [caseData,        setCaseData]         = useState(null);
  const [stages,          setStages]           = useState([]);

  /* assignment (Collect Additional Requirements) */
  const [assignmentId,    setAssignmentId]     = useState("");
  const [actionId,        setActionId]         = useState("");

  /* dynamic UI Resources */
  const [uiResources,      setUiResources]      = useState(null);
  const [actionButtons,    setActionButtons]    = useState(null);

  /* requirement rows (with injected _file, _attachmentId) */
  const [reqRows,         setReqRows]          = useState([]);
  const [uploading,       setUploading]        = useState({});  /* { rowIndex: bool } */

  /* If-Match header for PATCH */
  const [ifMatch,         setIfMatch]          = useState("");

  /* review step state */
  const [reviewRows,      setReviewRows]       = useState([]);
  const [reviewSubmitting,setReviewSubmitting] = useState(false);

  const [nextAssign,      setNextAssign]       = useState(null);

  const authRef = useRef(false);

  /* ── Toast helper ──────────────────────────────────────────── */
  const addToast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  /* ── 1. Authenticate ───────────────────────────────────────── */
  const authenticate = useCallback(async () => {
    setLoadingMsg("Authenticating with Pega…");
    const params = new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const res = await fetch(TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params,
    });

    if (!res.ok) throw new Error("Authentication failed");
    const data = await res.json();
    return data.access_token;
  }, []);

  /* ── 2. Get Case Details ───────────────────────────────────── */
  const getCaseDetails = useCallback(async (tok, caseId) => {
    setLoadingMsg("Loading case details…");
    const res = await fetch(
      `${API_BASE}/cases/${encodeId(caseId)}?viewType=page`,
      { headers: { Authorization: `Bearer ${tok}` } }
    );
    if (!res.ok) throw new Error("Failed to get case details");
    return res.json();
  }, []);

  /* ── 3. Get Assignment View Metadata ───────────────────────── */
  const getAssignmentMeta = useCallback(async (tok, asgId, actId) => {
    setLoadingMsg("Loading assignment view…");
    const url = `${ASSIGN_BASE}/assignments/${encodeId(asgId)}/actions/${actId}?viewType=form`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) throw new Error("Failed to get assignment metadata");
    /* Capture If-Match from response headers */
    const etag = res.headers.get("If-Match") || res.headers.get("ETag") || res.headers.get("etag") || "";
    setIfMatch(etag);
    return res.json();
  }, []);

  /* ── 4. Upload Attachment ──────────────────────────────────── */
  const uploadAttachment = useCallback(async (tok, file) => {
    const formData = new FormData();
    formData.append("content", file, file.name);
    formData.append(
      "clientRequest",
      JSON.stringify({ name: file.name, type: file.type })
    );

    const res = await fetch(`${API_BASE}/attachments/upload`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body:    formData,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return res.json(); // { ID: "..." }
  }, []);

  /* ── 5. Submit CollectAdditionalRequirements (PATCH) ────────── */
  const submitCollect = useCallback(async (tok, asgId, actId, rows) => {
    const pageInstructions = [];

    rows.forEach((_, idx) => {
      const listIndex = idx + 1;
      pageInstructions.push({ content: {}, target: ".RequirementLists", listIndex, instruction: "UPDATE" });
    });

    rows.forEach((row, idx) => {
      if (row._attachmentId) {
        pageInstructions.push({
          target:      `.RequirementLists(${idx + 1}).RequiredAttachment`,
          content:     { ID: row._attachmentId },
          instruction: "REPLACE",
        });
      }
    });

    const headers = {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${tok}`,
    };
    if (ifMatch) headers["If-Match"] = ifMatch;

    const res = await fetch(
      `${API_BASE}/assignments/${encodeId(asgId)}/actions/${actId}?viewType=form`,
      {
        method:  "PATCH",
        headers,
        body:    JSON.stringify({ content: {}, pageInstructions }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Submit failed: ${res.status} ${txt}`);
    }
    return res.json();
  }, [ifMatch]);

  /* ── 6. Submit ReviewAttachedDocuments (PATCH) ──────────────── */
  const submitReview = useCallback(async (tok, asgId, actId, rows) => {
    const pageInstructions = rows.map((row, idx) => ({
      content: {
        Requirement:     row.Requirement || "",
        Detail:          row.Detail      || "",
        Level:           row.Level       || "",
        RequirementType: row.RequirementType || "",
        Status:          row.Status      || "",
      },
      target:      ".RequirementLists",
      listIndex:   idx + 1,
      instruction: "UPDATE",
    }));

    const headers = {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${tok}`,
    };
    if (ifMatch) headers["If-Match"] = ifMatch;

    const res = await fetch(
      `${API_BASE}/assignments/${encodeId(asgId)}/actions/${actId}?viewType=form`,
      {
        method:  "PATCH",
        headers,
        body:    JSON.stringify({ content: {}, pageInstructions }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Review submit failed: ${res.status} ${txt}`);
    }
    return res.json();
  }, [ifMatch]);

  /* ── Initialise: auth → case → assignment ──────────────────── */
  const init = useCallback(async () => {
    setStep("LOADING");
    setError("");
    try {
      /* 1. Auth */
      const tok = await authenticate();
      setToken(tok);

      /* 2. Case details */
      const caseRes = await getCaseDetails(tok, DEFAULT_CASE_ID);
      const ci      = caseRes.data.caseInfo;
      setCaseData(ci);
      setStages(ci.stages || []);

      /* 3. Find first assignment + action */
      const asg = ci.assignments?.[0];
      if (!asg) throw new Error("No assignments found on case");

      const asgId = asg.ID;
      const actId = asg.actions?.[0]?.ID;
      setAssignmentId(asgId);
      setActionId(actId);

      /* 4. Get assignment view metadata */
      const metaRes = await getAssignmentMeta(tok, asgId, actId);
      setUiResources(metaRes.uiResources?.resources || null);
      setActionButtons(metaRes.uiResources?.actionButtons || null);

      const content = metaRes.data?.caseInfo?.content;
      const reqList = content?.RequirementLists || [];

      setReqRows(reqList.map((r) => ({ ...r, _file: null, _attachmentId: null })));

      setStep("COLLECT_REQ");
      addToast("Case loaded successfully", "success");
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStep("ERROR");
    }
  }, [authenticate, getCaseDetails, getAssignmentMeta, addToast]);

  useEffect(() => {
    if (authRef.current) return;
    authRef.current = true;
    init();
  }, [init]);

  /* ── Handle file select for a row ──────────────────────────── */
  const handleFileSelect = useCallback(async (rowIndex, file) => {
    if (!file) {
      /* Remove */
      setReqRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], _file: null, _attachmentId: null };
        return next;
      });
      return;
    }

    /* Upload immediately */
    setUploading((p) => ({ ...p, [rowIndex]: true }));
    try {
      const result = await uploadAttachment(token, file);
      setReqRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], _file: file, _attachmentId: result.ID };
        return next;
      });
      addToast(`"${file.name}" uploaded`, "success");
    } catch (e) {
      addToast(e.message, "error");
    } finally {
      setUploading((p) => ({ ...p, [rowIndex]: false }));
    }
  }, [token, uploadAttachment, addToast]);

  /* ── Submit Collect Additional Requirements ─────────────────── */
  const handleCollectSubmit = useCallback(async () => {
    const missing = reqRows.filter((r) => !r._attachmentId);
    if (missing.length) {
      addToast(`Please upload attachments for all ${missing.length} row(s)`, "error");
      return;
    }

    setStep("LOADING");
    setLoadingMsg("Submitting requirements…");
    setError("");

    try {
      const res = await submitCollect(token, assignmentId, actionId, reqRows);

      /* Update uiResources and actionButtons from next assignment view */
      setUiResources(res.uiResources?.resources || null);
      setActionButtons(res.uiResources?.actionButtons || null);

      /* Next assignment info */
      const nextAsg = res.data?.caseInfo?.assignments?.[0];
      const nextAct = nextAsg?.actions?.[0];
      const nextContent = res.data?.caseInfo?.content;

      setNextAssign(res.nextAssignmentInfo || null);
      setAssignmentId(nextAsg?.ID || assignmentId);
      setActionId(nextAct?.ID || "");

      /* Update stages */
      setStages(res.data?.caseInfo?.stages || stages);

      /* Build review rows */
      const updatedList = nextContent?.RequirementLists || reqRows;
      setReviewRows(updatedList.map((r) => ({ ...r })));

      /* Update If-Match for next call */
      setIfMatch("");

      addToast("Requirements submitted!", "success");
      setStep("REVIEW_DOCS");
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStep("COLLECT_REQ");
      addToast(e.message, "error");
    }
  }, [token, assignmentId, actionId, reqRows, submitCollect, stages, addToast]);

  /* ── Review row change ──────────────────────────────────────── */
  const handleReviewRowChange = useCallback((rowIndex, field, value) => {
    setReviewRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }, []);

  /* ── Submit ReviewAttachedDocuments ─────────────────────────── */
  const handleReviewSubmit = useCallback(async () => {
    setReviewSubmitting(true);
    setError("");
    try {
      await submitReview(token, assignmentId, actionId, reviewRows);
      addToast("Documents reviewed and submitted!", "success");
      setStep("SUCCESS");
    } catch (e) {
      console.error(e);
      addToast(e.message, "error");
    } finally {
      setReviewSubmitting(false);
    }
  }, [token, assignmentId, actionId, reviewRows, submitReview, addToast]);

  /* ── Derived case info ──────────────────────────────────────── */
  const caseId       = caseData?.ID           || DEFAULT_CASE_ID;
  const caseName     = caseData?.name          || "Intake FNOL";
  const caseStatus   = caseData?.status        || "";
  const caseUrgency  = caseData?.urgency       || "";
  const assignee     = caseData?.assignments?.[0]?.assigneeInfo?.name || "—";
  const stageLabel   = caseData?.stageLabel    || "";
  const businessId   = caseData?.businessID    || "";

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="shell">

      {/* ── Top Navigation ─────────────────────────── */}
      <nav className="top-nav">
        <div className="nav-brand">
          <div className="nav-logo">BU</div>
          <div>
            <div className="nav-title">Beneficiary Update</div>
            <div className="nav-subtitle">Intake FNOL · Mphasis GenAI Portal</div>
          </div>
        </div>

        <div className="nav-pills">
          {caseStatus && (
            <div className="nav-pill">
              <div className="nav-pill-dot" />
              {caseStatus}
            </div>
          )}
          {caseUrgency !== "" && (
            <div className="nav-pill"> Urgency {caseUrgency}</div>
          )}
          {stageLabel && (
            <div className="nav-pill"> {stageLabel}</div>
          )}
        </div>
      </nav>

      {/* ── Stages Bar ─────────────────────────────── */}
      {(step === "COLLECT_REQ" || step === "REVIEW_DOCS" || step === "SUCCESS") && (
        <StagesBar stages={stages} />
      )}

      {/* ── Loading ────────────────────────────────── */}
      {step === "LOADING" && (
        <div className="center-screen">
          <div className="big-spinner" />
          <div className="loading-label">{loadingMsg}</div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────── */}
      {step === "ERROR" && (
        <div className="center-screen">
          <div style={{ fontSize: 40 }}></div>
          <div className="error-box" style={{ maxWidth: 420 }}>
            <span>✕</span> {error}
          </div>
          <button className="btn btn-primary" onClick={init}>Retry</button>
        </div>
      )}

      {/* ── COLLECT ADDITIONAL REQUIREMENTS ─────────── */}
      {step === "COLLECT_REQ" && (
        <div className="app-body">
          <main className="main-content fade-in">

            {/* Case info bar */}
            <div className="case-info-bar">
              <div className="case-info-left">
                <div className="case-icon"></div>
                <div>
                  <div className="case-title">{caseName}</div>
                  <div className="case-id">{caseId} {businessId && `· ${businessId}`}</div>
                </div>
              </div>
              <div className="case-meta">
                <div className="meta-chip"> <strong>{assignee}</strong></div>
                <div className="meta-chip"> Urgency <strong>{caseUrgency}</strong></div>
                <span className="status-badge">{caseStatus}</span>
              </div>
            </div>

            {error && (
              <div className="error-box">
                <span>✕</span> {error}
              </div>
            )}

            {/* Requirements table card */}
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title">
                  <div className="card-title-icon"></div>
                  {caseData?.assignments?.[0]?.name || "Collect Additional Requirements"}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Upload attachments for each requirement
                </span>
              </div>

              <div className="card-body">
                <CollectReqTable
                  rows={reqRows}
                  onFileSelect={handleFileSelect}
                  uploading={uploading}
                  uiResources={uiResources}
                />
              </div>

              <div className="action-bar">
                {actionButtons?.secondary?.map((btn, i) => (
                  <button key={i} className="btn btn-ghost" onClick={btn.actionID === "save" ? null : init}>
                    {btn.name}
                  </button>
                )) || (
                  <button className="btn btn-ghost" onClick={init}>
                    ↺ Refresh
                  </button>
                )}
                {actionButtons?.main?.map((btn, i) => (
                  <button
                    key={i}
                    className="btn btn-primary"
                    onClick={handleCollectSubmit}
                    disabled={Object.values(uploading).some(Boolean)}
                  >
                    {Object.values(uploading).some(Boolean) ? (
                      <><div className="btn-spinner" /> Uploading…</>
                    ) : (
                      btn.name
                    )}
                  </button>
                )) || (
                  <button
                    className="btn btn-primary"
                    onClick={handleCollectSubmit}
                    disabled={Object.values(uploading).some(Boolean)}
                  >
                    {Object.values(uploading).some(Boolean) ? (
                      <><div className="btn-spinner" /> Uploading…</>
                    ) : (
                      "Submit Requirements →"
                    )}
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* ── Sidebar ────────────────────────────── */}
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section-title"> Case Details</div>
              <div className="sidebar-field">
                <div className="sidebar-label">Case ID</div>
                <div className="sidebar-value">{businessId || caseId}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Type</div>
                <div className="sidebar-value">{caseData?.caseTypeName || "Intake FNOL"}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Status</div>
                <div className="sidebar-value">{caseStatus}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Urgency</div>
                <div className="sidebar-value">{caseUrgency}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Owner</div>
                <div className="sidebar-value">{caseData?.owner || "—"}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Created</div>
                <div className="sidebar-value">
                  {caseData?.createTime
                    ? new Date(caseData.createTime).toLocaleDateString("en-US", { year:"numeric",month:"short",day:"numeric" })
                    : "—"}
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title"> Assignment</div>
              <div className="sidebar-field">
                <div className="sidebar-label">Task</div>
                <div className="sidebar-value">
                  {caseData?.assignments?.[0]?.name || "Collect Additional Requirements"}
                </div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Assignee</div>
                <div className="sidebar-value">{assignee}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Process</div>
                <div className="sidebar-value">
                  {caseData?.assignments?.[0]?.processName || "Review Requirements"}
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title"> Progress</div>
              <div className="sidebar-field">
                <div className="sidebar-label">Attachments</div>
                <div className="sidebar-value">
                  {reqRows.filter((r) => r._attachmentId).length} / {reqRows.length} uploaded
                </div>
              </div>
              <div style={{ marginTop: 8, height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  background: "var(--primary)",
                  borderRadius: 99,
                  width: `${reqRows.length ? (reqRows.filter((r) => r._attachmentId).length / reqRows.length) * 100 : 0}%`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── REVIEW ATTACHED DOCUMENTS ────────────────── */}
      {step === "REVIEW_DOCS" && (
        <div className="app-body">
          <main className="main-content fade-in">

            {/* Case info bar */}
            <div className="case-info-bar">
              <div className="case-info-left">
                <div className="case-icon"></div>
                <div>
                  <div className="case-title">{caseName} — Review Attached Documents</div>
                  <div className="case-id">{caseId} {businessId && `· ${businessId}`}</div>
                </div>
              </div>
              <div className="case-meta">
                <span className="status-badge">{caseStatus}</span>
              </div>
            </div>

            {/* Next assignment info */}
            {nextAssign && (
              <div className="next-assign-card fade-in">
                <div className="next-assign-label">▶ Next Step</div>
                <div className="next-assign-name">Review Attached Documents</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Review and update the requirement details below, then submit.
                </div>
              </div>
            )}

            {error && <div className="error-box"><span>✕</span> {error}</div>}

            {/* Review table card */}
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title">
                  <div className="card-title-icon"></div>
                  Review Attached Documents
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Review and confirm document details
                </span>
              </div>

              <div className="card-body">
                <ReviewReqTable
                  rows={reviewRows}
                  onRowChange={handleReviewRowChange}
                  uiResources={uiResources}
                />
              </div>

              <div className="action-bar">
                {actionButtons?.secondary?.map((btn, i) => (
                  <button
                    key={i}
                    className="btn btn-ghost"
                    onClick={() => setStep("COLLECT_REQ")}
                    disabled={reviewSubmitting}
                  >
                    {btn.name}
                  </button>
                )) || (
                  <button
                    className="btn btn-ghost"
                    onClick={() => setStep("COLLECT_REQ")}
                    disabled={reviewSubmitting}
                  >
                    ← Back
                  </button>
                )}
                {actionButtons?.main?.map((btn, i) => (
                  <button
                    key={i}
                    className="btn btn-primary"
                    onClick={handleReviewSubmit}
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? (
                      <><div className="btn-spinner" /> Submitting…</>
                    ) : (
                      btn.name
                    )}
                  </button>
                )) || (
                  <button
                    className="btn btn-primary"
                    onClick={handleReviewSubmit}
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? (
                      <><div className="btn-spinner" /> Submitting…</>
                    ) : (
                      "Submit Review ✓"
                    )}
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* ── Sidebar ────────────────────────────── */}
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section-title"> Case Details</div>
              <div className="sidebar-field">
                <div className="sidebar-label">Case ID</div>
                <div className="sidebar-value">{businessId || caseId}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Status</div>
                <div className="sidebar-value">{caseStatus}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Stage</div>
                <div className="sidebar-value">{stageLabel}</div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title"> Review Summary</div>
              {reviewRows.map((row, i) => (
                <div className="sidebar-field" key={i}>
                  <div className="sidebar-label">{row.Requirement || `Requirement ${i+1}`}</div>
                  <div className="sidebar-value">
                    <span className={`status-pill ${statusClass(row.Status)}`}>
                      {statusIcon(row.Status)} {row.Status || "—"}
                    </span>
                  </div>
                  {row.RequiredAttachment?.pyAttachName && (
                    <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>
                       {row.RequiredAttachment.pyAttachName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* ── SUCCESS ──────────────────────────────────── */}
      {step === "SUCCESS" && (
        <div className="center-screen fade-in">
          <div className="success-card">
            <div className="success-icon">✓</div>
            <div className="success-title">All Done!</div>
            <div className="success-sub">
              Requirements collected and documents reviewed successfully.<br />
              The case has been updated in Pega.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                className="btn btn-ghost"
                onClick={() => { authRef.current = false; init(); }}
              >
                ↺ Start Over
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep("REVIEW_DOCS")}
              >
                ← Back to Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ───────────────────────────────────── */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
