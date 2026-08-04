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
  return meta.label || fallback || fieldId;
};

const getFieldOptions = (uiResources, fieldId, fallbackList = []) => {
  const meta = getFieldMeta(uiResources, fieldId);
  const records = meta.datasource?.records;
  if (records && Array.isArray(records)) {
    return records.map((r) => r.value || r.key);
  }
  return fallbackList;
};

const resolveOptions = (fieldId, fieldConfig, uiResources, apiData) => {
  const meta = getFieldMeta(uiResources, fieldId);
  if (meta.datasource?.tableType === "PromptList" && Array.isArray(meta.datasource.records)) {
    return meta.datasource.records.map((r) => ({ label: r.value || r.key, value: r.key }));
  }

  const ds = fieldConfig?.datasource;
  if (ds && typeof ds === "object" && ds.source) {
    const match = ds.source.match(/@DATASOURCE\s+([\w_]+)\.pxResults/);
    if (match) {
      const dpName = match[1];
      const results = apiData?.[dpName]?.pxResults || 
                      apiData?.shared?.[dpName]?.[dpName]?.pxResults || 
                      apiData?.shared?.[dpName]?.pxResults;
      if (Array.isArray(results)) {
        const valProp = ds.fields?.value?.replace(/^@P \./, "") || "pyCallingCode";
        return results.map((item) => ({
          label: item[valProp] || item.pyCallingCode || "",
          value: item[valProp] || item.pyCallingCode || ""
        }));
      }
    }
  }

  if (fieldId === "ClaimantType") {
    return [
      { label: "Nominee", value: "Nominee" },
      { label: "Legal Heir", value: "Legal Heir" },
      { label: "Executor", value: "Executor" }
    ];
  }
  if (fieldId === "RelationshipWithInsured") {
    return [
      { label: "Spouse", value: "Spouse" },
      { label: "Father", value: "Father" },
      { label: "Mother", value: "Mother" },
      { label: "Daughter", value: "Daughter" },
      { label: "Son", value: "Son" },
      { label: "In Laws", value: "In Laws" }
    ];
  }
  return [];
};

function renderFieldInput(type, fieldId, config, uiResources, formValues, onChange, apiData, _onFileSelect, _uploading) {
  const value = formValues[fieldId] || "";

  switch (type) {
    case "TextInput":
      return (
        <input
          type="text"
          className="form-input"
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value)}
        />
      );
    case "TextArea":
      return (
        <textarea
          className="form-input"
          rows={3}
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value)}
        />
      );
    case "Integer":
      return (
        <input
          type="number"
          step="1"
          className="form-input"
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value === "" ? "" : parseInt(e.target.value, 10))}
        />
      );
    case "Decimal":
      return (
        <input
          type="number"
          step="any"
          className="form-input"
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value === "" ? "" : parseFloat(e.target.value))}
        />
      );
    case "Email":
      return (
        <input
          type="email"
          className="form-input"
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value)}
        />
      );
    case "Date":
      return (
        <input
          type="date"
          className="form-input"
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value)}
        />
      );
    case "Dropdown": {
      const options = resolveOptions(fieldId, config, uiResources, apiData);
      return (
        <select
          className="form-select"
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value)}
        >
          <option value="">{config.placeholder || "Select..."}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    case "Phone": {
      const callingCodeOptions = resolveOptions(fieldId, config, uiResources, apiData);
      const callingCodeVal = formValues["pyCallingCode"] || "";
      return (
        <div style={{ display: "flex", gap: "8px" }}>
          <select
            className="form-select"
            style={{ width: "100px", flexShrink: 0 }}
            value={callingCodeVal}
            onChange={(e) => onChange("pyCallingCode", e.target.value)}
          >
            <option value="">Code</option>
            {callingCodeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            className="form-input"
            style={{ flexGrow: 1 }}
            value={value}
            onChange={(e) => onChange(fieldId, e.target.value)}
          />
        </div>
      );
    }
    default:
      return (
        <input
          type="text"
          className="form-input"
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value)}
        />
      );
  }
}

function DynamicForm({ viewName, uiResources, formValues, onChange, apiData, onFileSelect, uploading }) {
  if (!viewName || !uiResources?.views) return null;
  const viewDefs = uiResources.views[viewName];
  if (!viewDefs || !viewDefs.length) return null;

  const viewDef = viewDefs[0];
  
  const renderChildren = (children) => {
    if (!children || !Array.isArray(children)) return null;
    return children.map((child, idx) => {
      const type = child.type;
      const config = child.config || {};

      if (type === "Region") {
        return (
          <div key={idx} className={`region-${child.name || idx}`}>
            {renderChildren(child.children)}
          </div>
        );
      }

      if (type === "Group") {
        return (
          <div key={config.id || idx} className="form-group-card">
            {config.showHeading && config.heading && (
              <h3 className="form-group-heading">{config.heading.replace(/^@L /, "")}</h3>
            )}
            <div className="form-grid">
              {renderChildren(child.children)}
            </div>
          </div>
        );
      }

      if (type === "reference") {
        if (config.type === "view") {
          return (
            <DynamicForm
              key={idx}
              viewName={config.name}
              uiResources={uiResources}
              formValues={formValues}
              onChange={onChange}
              apiData={apiData}
              onFileSelect={onFileSelect}
              uploading={uploading}
            />
          );
        }
      }

      const isField = [
        "TextInput", "Dropdown", "Phone", "Email", "Date", "TextArea", "Integer", "Decimal", "Stages", "DeferLoad"
      ].includes(type);

      if (isField) {
        const fieldVal = config.value || "";
        const fieldId = fieldVal.replace(/^@P \./, "").replace(/^@USER \./, "") || child.name;
        
        if (!fieldId) return null;

        if (type === "Stages") return null;
        if (type === "DeferLoad") return null;

        const label = getFieldLabel(uiResources, fieldId, config.label?.replace(/^@FL \./, "")?.replace(/^@L /, ""));

        return (
          <div key={fieldId} className="field-container">
            <label className="field-label">{label}</label>
            {renderFieldInput(type, fieldId, config, uiResources, formValues, onChange, apiData, onFileSelect, uploading)}
          </div>
        );
      }

      return null;
    });
  };

  return <div className="dynamic-view">{renderChildren(viewDef.children)}</div>;
}

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

  /* assignment */
  const [assignmentId,    setAssignmentId]     = useState("");
  const [actionId,        setActionId]         = useState("");

  /* dynamic UI Resources */
  const [uiResources,      setUiResources]      = useState(null);
  const [rootViewName,     setRootViewName]     = useState("");
  const [actionButtons,    setActionButtons]    = useState(null);
  const [apiData,          setApiData]          = useState(null);

  /* dynamic Form Values */
  const [formValues,      setFormValues]       = useState({});

  /* requirement rows (fallback for requirements workflow) */
  const [reqRows,         setReqRows]          = useState([]);
  const [uploading,       setUploading]        = useState({});  /* { rowIndex: bool } */

  /* If-Match header for PATCH */
  const [ifMatch,         setIfMatch]          = useState("");

  /* review step state (fallback for requirements workflow) */
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
      setRootViewName(metaRes.uiResources?.root?.config?.name || "");
      setActionButtons(metaRes.uiResources?.actionButtons || null);
      setApiData(metaRes.data || null);

      const content = metaRes.data?.caseInfo?.content || {};
      setFormValues({ ...content });

      const reqList = content?.RequirementLists || [];
      setReqRows(reqList.map((r) => ({ ...r, _file: null, _attachmentId: null })));
      setReviewRows(reqList.map((r) => ({ ...r })));

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

  /* ── Dynamic Field Change Handler ──────────────────────────── */
  const handleFieldChange = useCallback((fieldId, value) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldId]: value
    }));
  }, []);

  /* ── Dynamic Form submission ───────────────────────────────── */
  const handleDynamicSubmit = useCallback(async () => {
    setStep("LOADING");
    setLoadingMsg("Submitting assignment…");
    setError("");
    try {
      const payloadContent = {};
      const pageInstructions = [];

      Object.keys(formValues).forEach((key) => {
        if (Array.isArray(formValues[key])) {
          formValues[key].forEach((row, idx) => {
            pageInstructions.push({
              content: {
                Requirement:     row.Requirement     || "",
                Detail:          row.Detail          || "",
                Level:           row.Level           || "",
                RequirementType: row.RequirementType || "",
                Status:          row.Status          || "",
              },
              target:      `.${key}`,
              listIndex:   idx + 1,
              instruction: "UPDATE",
            });
            if (row._attachmentId) {
              pageInstructions.push({
                target:      `.${key}(${idx + 1}).RequiredAttachment`,
                content:     { ID: row._attachmentId },
                instruction: "REPLACE",
              });
            }
          });
        } else {
          if (!key.startsWith("px") && !key.startsWith("py")) {
            payloadContent[key] = formValues[key];
          }
        }
      });

      const bodyPayload = { content: payloadContent };
      if (pageInstructions.length > 0) {
        bodyPayload.pageInstructions = pageInstructions;
      }

      const headers = {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${token}`,
      };
      if (ifMatch) headers["If-Match"] = ifMatch;

      const res = await fetch(
        `${API_BASE}/assignments/${encodeId(assignmentId)}/actions/${actionId}?viewType=form`,
        {
          method:  "PATCH",
          headers,
          body:    JSON.stringify(bodyPayload),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Submit failed: ${res.status} ${txt}`);
      }

      const resJson = await res.json();
      addToast("Assignment submitted successfully!", "success");

      const nextAsg = resJson.data?.caseInfo?.assignments?.[0];
      if (nextAsg) {
        const nextActId = nextAsg.actions?.[0]?.ID;
        setAssignmentId(nextAsg.ID);
        setActionId(nextActId || "");
        setStages(resJson.data?.caseInfo?.stages || stages);
        setCaseData(resJson.data?.caseInfo || caseData);

        const nextMeta = await getAssignmentMeta(token, nextAsg.ID, nextActId);
        setUiResources(nextMeta.uiResources?.resources || null);
        setActionButtons(nextMeta.uiResources?.actionButtons || null);

        const nextContent = nextMeta.data?.caseInfo?.content || {};
        setFormValues({ ...nextContent });

        if (Array.isArray(nextContent.RequirementLists)) {
          setReqRows(nextContent.RequirementLists.map((r) => ({ ...r, _file: null, _attachmentId: null })));
          setReviewRows(nextContent.RequirementLists.map((r) => ({ ...r })));
          if (nextAsg.processID === "ReviewRequirements_Flow" || nextActId === "ReviewAttachedDocuments") {
            setStep("REVIEW_DOCS");
          } else {
            setStep("COLLECT_REQ");
          }
        } else {
          setStep("COLLECT_REQ");
        }
      } else {
        setStep("SUCCESS");
      }
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStep("COLLECT_REQ");
      addToast(e.message, "error");
    }
  }, [token, assignmentId, actionId, formValues, ifMatch, getAssignmentMeta, stages, caseData, addToast]);

  /* ── Fill Form with Sample Data ────────────────────────────── */
  const handleFillSampleData = useCallback(() => {
    const sampleData = {
      ClaimantName:                 "Alexander Fleming",
      ClaimantType:                 "Nominee",
      RelationshipWithInsured:      "Son",
      pyCallingCode:                "+1",
      ClaimantContactNumber:        "2025550143",
      ClaimantEmailID:              "alexander.fleming@example.com",
      ClaimantDOB:                  "1994-08-04",
      ClaimantAddressLine1:         "123 Innovation Way, Suite 400",
      ClaimantPostalCode:           "10001",
      ClaimantIdentificationNumber: 846667806
    };
    setFormValues((prev) => ({
      ...prev,
      ...sampleData
    }));
    addToast("Populated form with realistic sample data", "info");
  }, [addToast]);

  /* ── Handle file select for a row ──────────────────────────── */
  const handleFileSelect = useCallback(async (rowIndex, file) => {
    if (!file) {
      setReqRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], _file: null, _attachmentId: null };
        return next;
      });
      return;
    }

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

  /* ── Submit Collect Additional Requirements (Legacy fallback) ── */
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
      // Re-use dynamic submit helper by parsing reqRows into RequirementLists in formValues
      const nextValues = { ...formValues, RequirementLists: reqRows };
      setFormValues(nextValues);
      
      // Execute the submit with reqRows injected
      const payloadContent = {};
      const pageInstructions = reqRows.map((row, idx) => {
        const listIndex = idx + 1;
        return {
          content: {},
          target: ".RequirementLists",
          listIndex,
          instruction: "UPDATE"
        };
      });

      reqRows.forEach((row, idx) => {
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
        Authorization:   `Bearer ${token}`,
      };
      if (ifMatch) headers["If-Match"] = ifMatch;

      const res = await fetch(
        `${API_BASE}/assignments/${encodeId(assignmentId)}/actions/${actionId}?viewType=form`,
        {
          method:  "PATCH",
          headers,
          body:    JSON.stringify({ content: payloadContent, pageInstructions }),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Submit failed: ${res.status} ${txt}`);
      }

      const resJson = await res.json();
      setUiResources(resJson.uiResources?.resources || null);
      setActionButtons(resJson.uiResources?.actionButtons || null);

      const nextAsg = resJson.data?.caseInfo?.assignments?.[0];
      const nextAct = nextAsg?.actions?.[0];
      const nextContent = resJson.data?.caseInfo?.content || {};

      setNextAssign(resJson.nextAssignmentInfo || null);
      setAssignmentId(nextAsg?.ID || assignmentId);
      setActionId(nextAct?.ID || "");
      setStages(resJson.data?.caseInfo?.stages || stages);

      setReviewRows((nextContent?.RequirementLists || reqRows).map((r) => ({ ...r })));
      setIfMatch("");

      addToast("Requirements submitted!", "success");
      setStep("REVIEW_DOCS");
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStep("COLLECT_REQ");
      addToast(e.message, "error");
    }
  }, [token, assignmentId, actionId, reqRows, formValues, stages, ifMatch, addToast]);

  /* ── Review row change ──────────────────────────────────────── */
  const handleReviewRowChange = useCallback((rowIndex, field, value) => {
    setReviewRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }, []);

  /* ── Submit ReviewAttachedDocuments (Legacy fallback) ───────── */
  const handleReviewSubmit = useCallback(async () => {
    setReviewSubmitting(true);
    setError("");
    try {
      const pageInstructions = reviewRows.map((row, idx) => ({
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
        Authorization:   `Bearer ${token}`,
      };
      if (ifMatch) headers["If-Match"] = ifMatch;

      const res = await fetch(
        `${API_BASE}/assignments/${encodeId(assignmentId)}/actions/${actionId}?viewType=form`,
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

      addToast("Documents reviewed and submitted!", "success");
      setStep("SUCCESS");
    } catch (e) {
      console.error(e);
      addToast(e.message, "error");
    } finally {
      setReviewSubmitting(false);
    }
  }, [token, assignmentId, actionId, reviewRows, ifMatch, addToast]);

  /* ── Derived case info ──────────────────────────────────────── */
  const caseId       = caseData?.ID           || DEFAULT_CASE_ID;
  const caseName     = caseData?.name          || "Intake FNOL";
  const caseStatus   = caseData?.status        || "";
  const caseUrgency  = caseData?.urgency       || "";
  const assignee     = caseData?.assignments?.[0]?.assigneeInfo?.name || "—";
  const stageLabel   = caseData?.stageLabel    || "";
  const businessId   = caseData?.businessID    || "";

  const isRequirementListFlow = Array.isArray(formValues.RequirementLists);

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

      {/* ── COLLECT ADDITIONAL REQUIREMENTS / DYNAMIC FORM ─── */}
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

            {/* Main Assignment card */}
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title">
                  <div className="card-title-icon"></div>
                  {caseData?.assignments?.[0]?.name || "Collect Claimant Details"}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {isRequirementListFlow ? "Upload attachments for each requirement" : "Please fill out all the details below"}
                </span>
              </div>

              <div className="card-body">
                {isRequirementListFlow ? (
                  <CollectReqTable
                    rows={reqRows}
                    onFileSelect={handleFileSelect}
                    uploading={uploading}
                    uiResources={uiResources}
                  />
                ) : (
                  <DynamicForm
                    viewName={rootViewName}
                    uiResources={uiResources}
                    formValues={formValues}
                    onChange={handleFieldChange}
                    apiData={apiData}
                    onFileSelect={handleFileSelect}
                    uploading={uploading}
                  />
                )}
              </div>

              <div className="action-bar">
                {/* Dynamically render action buttons from active view metadata */}
                {actionButtons?.secondary?.map((btn, i) => {
                  let onClickHandler = null;
                  if (btn.actionID === "fillFormWithAI" || btn.jsAction === "fillFormWithAI") {
                    onClickHandler = handleFillSampleData;
                  } else if (btn.actionID === "save") {
                    onClickHandler = null;
                  } else {
                    onClickHandler = init;
                  }
                  return (
                    <button key={i} className="btn btn-ghost" onClick={onClickHandler}>
                      {btn.name}
                    </button>
                  );
                }) || (
                  <button className="btn btn-ghost" onClick={init}>
                    ↺ Refresh
                  </button>
                )}

                {actionButtons?.main?.map((btn, i) => (
                  <button
                    key={i}
                    className="btn btn-primary"
                    onClick={isRequirementListFlow ? handleCollectSubmit : handleDynamicSubmit}
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
                    onClick={isRequirementListFlow ? handleCollectSubmit : handleDynamicSubmit}
                    disabled={Object.values(uploading).some(Boolean)}
                  >
                    {Object.values(uploading).some(Boolean) ? (
                      <><div className="btn-spinner" /> Uploading…</>
                    ) : (
                      "Submit"
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
                  {caseData?.assignments?.[0]?.name || "Collect Claimant Details"}
                </div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Assignee</div>
                <div className="sidebar-value">{assignee}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Process</div>
                <div className="sidebar-value">
                  {caseData?.assignments?.[0]?.processName || "Collect Details"}
                </div>
              </div>
            </div>

            {isRequirementListFlow && (
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
            )}
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
              {isRequirementListFlow && (
                <button
                  className="btn btn-primary"
                  onClick={() => setStep("REVIEW_DOCS")}
                >
                  ← Back to Review
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ───────────────────────────────────── */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
