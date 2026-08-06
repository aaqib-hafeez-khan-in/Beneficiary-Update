import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";

/* ── Environment ─────────────────────────────────────────────── */
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET;
const TOKEN_URL = import.meta.env.VITE_TOKEN_URL;
const API_BASE = import.meta.env.VITE_API_BASE;
const ASSIGN_BASE = import.meta.env.VITE_ASSIGNMENT_API_BASE;
const DEFAULT_CASE_ID =
  import.meta.env.VITE_CASE_ID || "OCW5DK-GENAI-WORK I-3004";

/* ── Helpers ─────────────────────────────────────────────────── */
const encodeId = (id) => encodeURIComponent(id);

const statusClass = (s = "") => {
  if (s === "NIGO") return "nigo";
  if (s === "IGO") return "igo";
  return "ordered";
};

const statusIcon = () => null;
// const statusIcon = (s = "") => {
//   if (s === "NIGO") return "⚠";
//   if (s === "IGO") return "✓";
//   if (s === "Ordered") return "⏳";
//   if (s === "Re-Ordered") return "🔄";
//   return "•";
// };
const resolveStatusLabel = (key, uiResources) => {
  const records = uiResources?.fields?.Status?.[0]?.datasource?.records;
  if (!records || !key) return key || "—";
  const match = records.find((r) => r.key === key);
  return match ? match.value : key;
};

const handleApiResponse = async (res, defaultErrorMsg) => {
  if (res.ok) return res.json();

  let errorMsg = defaultErrorMsg;
  try {
    const errorJson = await res.json();
    if (errorJson?.localizedValue) {
      errorMsg = errorJson.localizedValue;
      if (errorJson.errorDetails?.[0]?.localizedValue) {
        errorMsg += `: ${errorJson.errorDetails[0].localizedValue}`;
      }
    } else if (errorJson?.message) {
      errorMsg = errorJson.message;
    }
  } catch (_) {
    try {
      const text = await res.text();
      if (text) errorMsg = text;
    } catch (_) {}
  }

  throw new Error(errorMsg);
};

const normalizeReqRow = (r) => ({
  ...r,
});

const getColumnsFromMeta = (
  uiResources,
  viewName = "CollectAdditionalRequirements",
) => {
  if (!uiResources?.views?.[viewName]) return [];
  const viewDef = uiResources.views[viewName][0];
  const embeddedData = viewDef?.children?.[0]?.children?.[0];
  const columnsMeta = embeddedData?.config?.columns || [];

  const cols = [];

  columnsMeta.forEach((col) => {
    const config = col.config || {};
    if (col.type === "reference") {
      const refViewName = config.name;
      const refViews = uiResources.views?.[refViewName];
      if (refViews && refViews.length > 0) {
        const refView = refViews[0];
        const fieldsRegion = refView.children?.find((c) => c.name === "Fields");
        const children = fieldsRegion?.children || [];
        children.forEach((child) => {
          if (child.config?.value) {
            const prop = child.config.value.replace(
              /^@(P|ATTACHMENT|ASSOCIATED)\s+\./,
              "",
            );
            cols.push({
              id: prop,
              label: getFieldLabel(
                uiResources,
                prop,
                child.config.label?.replace(/^@FL\s+\./, ""),
              ),
              type: child.type,
              readOnly: child.config.readOnly,
            });
          }
        });
      }
    } else if (config.value) {
      const prop = config.value.replace(/^@(P|ATTACHMENT|ASSOCIATED)\s+\./, "");
      cols.push({
        id: prop,
        label: getFieldLabel(
          uiResources,
          prop,
          config.label?.replace(/^@FL\s+\./, ""),
        ),
        type: col.type,
        readOnly: config.readOnly,
      });
    }
  });

  return cols;
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
  if (
    meta.datasource?.tableType === "PromptList" &&
    Array.isArray(meta.datasource.records)
  ) {
    return meta.datasource.records.map((r) => ({
      label: r.value || r.key,
      value: r.key,
    }));
  }

  const ds = fieldConfig?.datasource;
  if (ds && typeof ds === "object" && ds.source) {
    const match = ds.source.match(/@DATASOURCE\s+([\w_]+)\.pxResults/);
    if (match) {
      const dpName = match[1];
      const results =
        apiData?.[dpName]?.pxResults ||
        apiData?.shared?.[dpName]?.[dpName]?.pxResults ||
        apiData?.shared?.[dpName]?.pxResults;
      if (Array.isArray(results)) {
        const valProp =
          ds.fields?.value?.replace(/^@P \./, "") || "pyCallingCode";
        return results.map((item) => ({
          label: item[valProp] || item.pyCallingCode || "",
          value: item[valProp] || item.pyCallingCode || "",
        }));
      }
    }
  }

  if (fieldId === "ClaimantType") {
    return [
      { label: "Nominee", value: "Nominee" },
      { label: "Legal Heir", value: "Legal Heir" },
      { label: "Executor", value: "Executor" },
    ];
  }
  if (fieldId === "RelationshipWithInsured") {
    return [
      { label: "Spouse", value: "Spouse" },
      { label: "Father", value: "Father" },
      { label: "Mother", value: "Mother" },
      { label: "Daughter", value: "Daughter" },
      { label: "Son", value: "Son" },
      { label: "In Laws", value: "In Laws" },
    ];
  }
  return [];
};

function renderFieldInput(
  type,
  fieldId,
  config,
  uiResources,
  formValues,
  onChange,
  apiData,
  _onFileSelect,
  _uploading,
) {
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
          onChange={(e) =>
            onChange(
              fieldId,
              e.target.value === "" ? "" : parseInt(e.target.value, 10),
            )
          }
        />
      );
    case "Decimal":
      return (
        <input
          type="number"
          step="any"
          className="form-input"
          value={value}
          onChange={(e) =>
            onChange(
              fieldId,
              e.target.value === "" ? "" : parseFloat(e.target.value),
            )
          }
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
      const callingCodeOptions = resolveOptions(
        fieldId,
        config,
        uiResources,
        apiData,
      );
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

function DynamicForm({
  viewName,
  uiResources,
  formValues,
  onChange,
  apiData,
  onFileSelect,
  uploading,
}) {
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
              <h3 className="form-group-heading">
                {config.heading.replace(/^@L /, "")}
              </h3>
            )}
            <div className="form-grid">{renderChildren(child.children)}</div>
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
        "TextInput",
        "Dropdown",
        "Phone",
        "Email",
        "Date",
        "TextArea",
        "Integer",
        "Decimal",
        "Stages",
        "DeferLoad",
      ].includes(type);

      if (isField) {
        const fieldVal = config.value || "";
        const fieldId =
          fieldVal.replace(/^@P \./, "").replace(/^@USER \./, "") || child.name;

        if (!fieldId) return null;

        if (type === "Stages") return null;
        if (type === "DeferLoad") return null;

        const label = getFieldLabel(
          uiResources,
          fieldId,
          config.label?.replace(/^@FL \./, "")?.replace(/^@L /, ""),
        );

        return (
          <div key={fieldId} className="field-container">
            <label className="field-label">{label}</label>
            {renderFieldInput(
              type,
              fieldId,
              config,
              uiResources,
              formValues,
              onChange,
              apiData,
              onFileSelect,
              uploading,
            )}
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
        <div
          key={t.id}
          className={`toast ${t.type}`}
          onClick={() => onRemove(t.id)}
          style={{ cursor: "pointer" }}
        >
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
  const cols = getColumnsFromMeta(uiResources, "CollectAdditionalRequirements");

  if (!cols.length) {
    cols.push(
      { id: "Requirement", label: "Requirement" },
      { id: "RequirementDescription", label: "Requirement Description" },
      { id: "Status", label: "Status" },
      { id: "RequiredAttachment", label: "Attachment", type: "Attachment" },
    );
  }

  return (
    <div className="req-table-wrapper">
      <table className="req-table">
        <thead>
          <tr>
            <th>#</th>
            {cols.map((col) => (
              <th key={col.id}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="fade-in">
              <td>{i + 1}</td>
              {cols.map((col) => {
                if (
                  col.type === "Attachment" ||
                  col.id === "RequiredAttachment"
                ) {
                  return (
                    <td key={col.id}>
                      <AttachCell
                        rowIndex={i}
                        file={row._file}
                        attachmentId={row._attachmentId}
                        isUploading={uploading[i]}
                        onSelect={onFileSelect}
                      />
                    </td>
                  );
                }
                if (col.id === "Status") {
                  return (
                    <td key={col.id}>
                      <span
                        className={`status-pill ${statusClass(row.Status)}`}
                      >
                        {resolveStatusLabel(row.Status, uiResources)}
                      </span>
                    </td>
                  );
                }
                return (
                  <td
                    key={col.id}
                    style={col.id === "Requirement" ? { fontWeight: 500 } : {}}
                  >
                    {row[col.id] || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Review Attached Documents Table (read-only + editable dropdowns) */
function ReviewReqTable({ rows, onRowChange, uiResources }) {
  const cols = getColumnsFromMeta(uiResources, "CollectAdditionalRequirements");

  if (!cols.length) {
    cols.push(
      { id: "Requirement", label: "Requirement" },
      { id: "RequirementDescription", label: "Requirement Description" },
      { id: "Status", label: "Status" },
      { id: "RequiredAttachment", label: "Attachment", type: "Attachment" },
    );
  }

  return (
    <div className="req-table-wrapper">
      <table className="req-table">
        <thead>
          <tr>
            <th>#</th>
            {cols.map((col) => (
              <th key={col.id}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="fade-in">
              <td>{i + 1}</td>
              {cols.map((col) => {
                if (
                  col.type === "Attachment" ||
                  col.id === "RequiredAttachment"
                ) {
                  return (
                    <td key={col.id}>
                      {row.RequiredAttachment?.pyAttachName ? (
                        <div className="file-chip">
                          <span></span>
                          <span
                            className="file-chip-name"
                            title={row.RequiredAttachment.pyAttachName}
                          >
                            {row.RequiredAttachment.pyAttachName}
                          </span>
                        </div>
                      ) : (
                        <span
                          style={{ color: "var(--text-subtle)", fontSize: 12 }}
                        >
                          No attachment
                        </span>
                      )}
                    </td>
                  );
                }
                if (col.type === "Dropdown" || col.id === "Status") {
                  const opts = getFieldOptions(uiResources, col.id, [
                    "IGO",
                    "NIGO",
                    "Ordered",
                    "Re-Ordered",
                  ]);
                  return (
                    <td key={col.id}>
                      <select
                        value={row[col.id] || ""}
                        onChange={(e) => onRowChange(i, col.id, e.target.value)}
                        disabled={col.readOnly}
                      >
                        <option value="">Select…</option>
                        {opts.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                }
                if (col.readOnly) {
                  return (
                    <td
                      key={col.id}
                      style={
                        col.id === "Requirement" ? { fontWeight: 500 } : {}
                      }
                    >
                      {row[col.id] || "—"}
                    </td>
                  );
                }
                return (
                  <td key={col.id}>
                    <input
                      type="text"
                      value={row[col.id] || ""}
                      onChange={(e) => onRowChange(i, col.id, e.target.value)}
                      style={{ minWidth: 120 }}
                    />
                  </td>
                );
              })}
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
          <span className="file-chip-name" title={file?.name}>
            {file?.name}
          </span>
          <span
            className="file-chip-remove"
            onClick={() => onSelect(rowIndex, null)}
            title="Remove"
          >
            ×
          </span>
        </div>
      ) : (
        <label className="attach-btn">
          <span> Upload</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            style={{ display: "none" }}
            onChange={(e) =>
              e.target.files?.[0] && onSelect(rowIndex, e.target.files[0])
            }
          />
        </label>
      )}
    </div>
  );
}

/* ── Main App ────────────────────────────────────────────────── */
export default function App() {
  /* Step machine:
     START → LOADING → CASE_LIST → COLLECT_REQ → REVIEW_DOCS → SUCCESS */
  const [step, setStep] = useState("START");
  const [loadingMsg, setLoadingMsg] = useState("Authenticating…");
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);

  /* auth */
  const [token, setToken] = useState("");

  /* case list */
  const [caseList, setCaseList] = useState([]);

  /* case */
  const [caseData, setCaseData] = useState(null);
  const [stages, setStages] = useState([]);

  /* assignment */
  const [assignmentId, setAssignmentId] = useState("");
  const [actionId, setActionId] = useState("");

  /* dynamic UI Resources */
  const [uiResources, setUiResources] = useState(null);
  const [rootViewName, setRootViewName] = useState("");
  const [actionButtons, setActionButtons] = useState(null);
  const [apiData, setApiData] = useState(null);

  /* dynamic Form Values */
  const [formValues, setFormValues] = useState({});

  /* requirement rows (fallback for requirements workflow) */
  const [reqRows, setReqRows] = useState([]);
  const [uploading, setUploading] = useState({}); /* { rowIndex: bool } */

  /* If-Match header for PATCH */
  const [ifMatch, setIfMatch] = useState("");

  /* review step state (fallback for requirements workflow) */
  const [reviewRows, setReviewRows] = useState([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [nextAssign, setNextAssign] = useState(null);

  const authRef = useRef(false);

  /* ── Toast helper ──────────────────────────────────────────── */
  const addToast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback(
    (id) => setToasts((p) => p.filter((t) => t.id !== id)),
    [],
  );

  /* ── 1. Authenticate ───────────────────────────────────────── */
  const authenticate = useCallback(async () => {
    setLoadingMsg("Authenticating with Pega…");
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!res.ok) throw new Error("Authentication failed");
    const data = await res.json();
    return data.access_token;
  }, []);

  /* ── 2. Fetch Case List (worklist) ─────────────────────────── */
  const getCaseList = useCallback(async (tok) => {
    setLoadingMsg("Fetching case list…");
    const res = await fetch(
      `${API_BASE}/data_views/D_GetWorkListOnAssignment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({
          dataViewParameters: { TaskLabel: "Collect Additional Requirements" },
        }),
      },
    );
    return handleApiResponse(res, "Failed to fetch case list");
  }, []);

  /* ── 3. Get Case Details ───────────────────────────────────── */
  const getCaseDetails = useCallback(async (tok, caseId) => {
    setLoadingMsg("Loading case details…");
    const res = await fetch(
      `${API_BASE}/cases/${encodeId(caseId)}?viewType=page`,
      { headers: { Authorization: `Bearer ${tok}` } },
    );
    return handleApiResponse(res, "Failed to get case details");
  }, []);

  /* ── 4. Get Assignment View Metadata ───────────────────────── */
  const getAssignmentMeta = useCallback(async (tok, asgId, actId) => {
    setLoadingMsg("Loading assignment view…");
    const url = `${ASSIGN_BASE}/assignments/${encodeId(asgId)}/actions/${actId}?viewType=form`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) {
      await handleApiResponse(res, "Failed to get assignment metadata");
    }
    /* Capture If-Match from response headers */
    const etag =
      res.headers.get("If-Match") ||
      res.headers.get("ETag") ||
      res.headers.get("etag") ||
      "";
    setIfMatch(etag);
    return res.json();
  }, []);

  /* ── 5. Upload Attachment ──────────────────────────────────── */
  const uploadAttachment = useCallback(async (tok, file) => {
    const formData = new FormData();
    formData.append("content", file, file.name);
    formData.append(
      "clientRequest",
      JSON.stringify({ name: file.name, type: file.type }),
    );

    const res = await fetch(`${API_BASE}/attachments/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body: formData,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return res.json(); // { ID: "..." }
  }, []);

  /* ── Initialise: auth → fetch worklist → show CASE_LIST ─────── */
  const init = useCallback(async () => {
    setStep("LOADING");
    setError("");
    setCaseList([]);
    setCaseData(null);
    try {
      const tok = await authenticate();
      setToken(tok);

      const listRes = await getCaseList(tok);
      /* Pega data view responses put results at data array or data.pxResults */
      const results =
        (Array.isArray(listRes?.data) ? listRes.data : null) ||
        listRes?.data?.pxResults ||
        listRes?.pxResults ||
        [];
      setCaseList(results);
      setStep("CASE_LIST");
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStep("ERROR");
    }
  }, [authenticate, getCaseList]);

  /* ── Load a selected case and proceed to the form ────────────── */
  const handleCaseSelect = useCallback(
    async (pxObjRef) => {
      setStep("LOADING");
      setError("");
      try {
        /* 1. Case details */
        const caseRes = await getCaseDetails(token, pxObjRef);
        const ci = caseRes.data.caseInfo;
        setCaseData(ci);
        setStages(ci.stages || []);

        /* 2. Find first assignment + action */
        const asg = ci.assignments?.[0];
        if (!asg) throw new Error("No assignments found on case");

        const asgId = asg.ID;
        const actId = asg.actions?.[0]?.ID;
        setAssignmentId(asgId);
        setActionId(actId);

        /* 3. Get assignment view metadata */
        const metaRes = await getAssignmentMeta(token, asgId, actId);
        setUiResources(metaRes.uiResources?.resources || null);
        setRootViewName(metaRes.uiResources?.root?.config?.name || "");
        setActionButtons(metaRes.uiResources?.actionButtons || null);
        setApiData(metaRes.data || null);

        const content = metaRes.data?.caseInfo?.content || {};
        setFormValues({ ...content });

        const reqList = content?.RequirementLists || [];
        setReqRows(
          reqList.map((r) => ({
            ...normalizeReqRow(r),
            _file: null,
            _attachmentId: null,
          })),
        );
        setReviewRows(reqList.map((r) => normalizeReqRow(r)));

        setStep("COLLECT_REQ");
        addToast("Case loaded successfully", "success");
      } catch (e) {
        console.error(e);
        setError(e.message);
        setStep("ERROR");
      }
    },
    [token, getCaseDetails, getAssignmentMeta, addToast],
  );

  /* Remove auto-init useEffect to let user click the Launch button first */

  /* ── Dynamic Field Change Handler ──────────────────────────── */
  const handleFieldChange = useCallback((fieldId, value) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldId]: value,
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
              content: Object.keys(row).reduce((acc, k) => {
                if (!k.startsWith("_") && k !== "classID") {
                  acc[k] = row[k];
                }
                return acc;
              }, {}),
              target: `.${key}`,
              listIndex: idx + 1,
              instruction: "UPDATE",
            });
            if (row._attachmentId) {
              pageInstructions.push({
                target: `.${key}(${idx + 1}).RequiredAttachment`,
                content: { ID: row._attachmentId },
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (ifMatch) headers["If-Match"] = ifMatch;

      const res = await fetch(
        `${API_BASE}/assignments/${encodeId(assignmentId)}/actions/${actionId}?viewType=form`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(bodyPayload),
        },
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
        setRootViewName(nextMeta.uiResources?.root?.config?.name || "");
        setActionButtons(nextMeta.uiResources?.actionButtons || null);
        setApiData(nextMeta.data || null);

        const nextContent = nextMeta.data?.caseInfo?.content || {};
        setFormValues({ ...nextContent });

        if (Array.isArray(nextContent.RequirementLists)) {
          setReqRows(
            nextContent.RequirementLists.map((r) => ({
              ...normalizeReqRow(r),
              _file: null,
              _attachmentId: null,
            })),
          );
          setReviewRows(
            nextContent.RequirementLists.map((r) => normalizeReqRow(r)),
          );
          if (
            nextAsg.processID === "ReviewRequirements_Flow" ||
            nextActId === "ReviewAttachedDocuments"
          ) {
            try {
              fetch(
                `${API_BASE}/assignments/${encodeId(nextAsg.ID)}/actions/${nextActId || "ReviewAttachedDocuments"}?viewType=form`,
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ content: {}, pageInstructions: [] }),
                },
              ).catch(() => {});
            } catch (_) {}
            setStep("SUCCESS");
          } else {
            setStep("SUCCESS");
          }
        } else {
          setStep("SUCCESS");
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
  }, [
    token,
    assignmentId,
    actionId,
    formValues,
    ifMatch,
    getAssignmentMeta,
    stages,
    caseData,
    addToast,
  ]);

  /* ── Fill Form with Sample Data ────────────────────────────── */
  const handleFillSampleData = useCallback(() => {
    const sampleData = {
      ClaimantName: "Alexander Fleming",
      ClaimantType: "Nominee",
      RelationshipWithInsured: "Son",
      pyCallingCode: "+1",
      ClaimantContactNumber: "2025550143",
      ClaimantEmailID: "alexander.fleming@example.com",
      ClaimantDOB: "1994-08-04",
      ClaimantAddressLine1: "123 Innovation Way, Suite 400",
      ClaimantPostalCode: "10001",
      ClaimantIdentificationNumber: 846667806,
    };
    setFormValues((prev) => ({
      ...prev,
      ...sampleData,
    }));
    addToast("Populated form with realistic sample data", "info");
  }, [addToast]);

  /* ── Handle file select for a row ──────────────────────────── */
  const handleFileSelect = useCallback(
    async (rowIndex, file) => {
      if (!file) {
        setReqRows((prev) => {
          const next = [...prev];
          next[rowIndex] = {
            ...next[rowIndex],
            _file: null,
            _attachmentId: null,
          };
          return next;
        });
        return;
      }

      setUploading((p) => ({ ...p, [rowIndex]: true }));
      try {
        const result = await uploadAttachment(token, file);
        setReqRows((prev) => {
          const next = [...prev];
          next[rowIndex] = {
            ...next[rowIndex],
            _file: file,
            _attachmentId: result.ID,
          };
          return next;
        });
        addToast(`"${file.name}" uploaded`, "success");
      } catch (e) {
        addToast(e.message, "error");
      } finally {
        setUploading((p) => ({ ...p, [rowIndex]: false }));
      }
    },
    [token, uploadAttachment, addToast],
  );

  /* ── Submit Collect Additional Requirements (Legacy fallback) ── */
  const handleCollectSubmit = useCallback(async () => {
    const missing = reqRows.filter((r) => !r._attachmentId);
    if (missing.length) {
      addToast(
        `Please upload attachments for all ${missing.length} row(s)`,
        "error",
      );
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
          instruction: "UPDATE",
        };
      });

      reqRows.forEach((row, idx) => {
        if (row._attachmentId) {
          pageInstructions.push({
            target: `.RequirementLists(${idx + 1}).RequiredAttachment`,
            content: { ID: row._attachmentId },
            instruction: "REPLACE",
          });
        }
      });

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (ifMatch) headers["If-Match"] = ifMatch;

      const res = await fetch(
        `${API_BASE}/assignments/${encodeId(assignmentId)}/actions/${actionId}?viewType=form`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ content: payloadContent, pageInstructions }),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Submit failed: ${res.status} ${txt}`);
      }

      const resJson = await res.json();

      const nextAsg = resJson.data?.caseInfo?.assignments?.[0];
      const nextAct = nextAsg?.actions?.[0];
      const nextContent = resJson.data?.caseInfo?.content || {};

      setNextAssign(resJson.nextAssignmentInfo || null);
      setAssignmentId(nextAsg?.ID || assignmentId);
      setActionId(nextAct?.ID || "");
      setStages(resJson.data?.caseInfo?.stages || stages);
      setCaseData(resJson.data?.caseInfo || caseData);

      /* Re-fetch next assignment metadata so uiResources + rootViewName stay in sync */
      if (nextAsg?.ID && nextAct?.ID) {
        try {
          const nextMeta = await getAssignmentMeta(
            token,
            nextAsg.ID,
            nextAct.ID,
          );
          setUiResources(nextMeta.uiResources?.resources || null);
          setRootViewName(nextMeta.uiResources?.root?.config?.name || "");
          setActionButtons(nextMeta.uiResources?.actionButtons || null);
          setApiData(nextMeta.data || null);
        } catch (_) {
          /* non-fatal – fall through */
        }
      }

      setReviewRows(
        (nextContent?.RequirementLists || reqRows).map((r) =>
          normalizeReqRow(r),
        ),
      );
      setIfMatch("");

      // Automatically finish review step in background if next assignment is ReviewAttachedDocuments
      if (
        nextAsg?.ID &&
        (nextAsg.processID === "ReviewRequirements_Flow" ||
          nextAct?.ID === "ReviewAttachedDocuments")
      ) {
        try {
          const pageInstructions = (
            nextContent?.RequirementLists || reqRows
          ).map((row, idx) => ({
            content: Object.keys(row).reduce((acc, k) => {
              if (!k.startsWith("_") && k !== "classID") {
                acc[k] = row[k];
              }
              return acc;
            }, {}),
            target: ".RequirementLists",
            listIndex: idx + 1,
            instruction: "UPDATE",
          }));
          fetch(
            `${API_BASE}/assignments/${encodeId(nextAsg.ID)}/actions/${nextAct?.ID || "ReviewAttachedDocuments"}?viewType=form`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ content: {}, pageInstructions }),
            },
          ).catch(() => {});
        } catch (_) {}
      }

      addToast("Requirements and documents submitted successfully!", "success");
      setStep("SUCCESS");
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStep("COLLECT_REQ");
      addToast(e.message, "error");
    }
  }, [
    token,
    assignmentId,
    actionId,
    reqRows,
    formValues,
    stages,
    ifMatch,
    caseData,
    getAssignmentMeta,
    addToast,
  ]);

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
    // Transition to SUCCESS immediately — do not wait for the API
    setStep("SUCCESS");
    try {
      const pageInstructions = reviewRows.map((row, idx) => ({
        content: Object.keys(row).reduce((acc, k) => {
          if (!k.startsWith("_") && k !== "classID") {
            acc[k] = row[k];
          }
          return acc;
        }, {}),
        target: ".RequirementLists",
        listIndex: idx + 1,
        instruction: "UPDATE",
      }));

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (ifMatch) headers["If-Match"] = ifMatch;

      const res = await fetch(
        `${API_BASE}/assignments/${encodeId(assignmentId)}/actions/${actionId}?viewType=form`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ content: {}, pageInstructions }),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        console.error(`Review submit failed: ${res.status} ${txt}`);
        addToast("Documents submitted with warnings.", "info");
      } else {
        addToast("Documents reviewed and submitted!", "success");
      }
    } catch (e) {
      console.error(e);
      addToast("Submission sent — could not confirm server response.", "info");
    } finally {
      setReviewSubmitting(false);
    }
  }, [token, assignmentId, actionId, reviewRows, ifMatch, addToast]);

  /* ── Derived case info ──────────────────────────────────────── */
  const caseId = caseData?.ID || DEFAULT_CASE_ID;
  const caseName = caseData?.name || "Intake FNOL";
  const caseStatus = caseData?.status || "";
  const caseUrgency = caseData?.urgency || "";
  const assignee = caseData?.assignments?.[0]?.assigneeInfo?.name || "—";
  const stageLabel = caseData?.stageLabel || "";
  const businessId = caseData?.businessID || "";

  const isRequirementListFlow = Array.isArray(formValues.RequirementLists);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="shell">
      {/* ── Top Navigation ─────────────────────────── */}
      {/* {step !== "START" && (
        <nav className="top-nav">
          <div className="nav-brand">
            <div className="nav-logo">BU</div>
            <div>
              <div className="nav-title">Respond to requirement</div>
              <div className="nav-subtitle">
                Intake FNOL · Mphasis GenAI Portal
              </div>
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
            {stageLabel && <div className="nav-pill"> {stageLabel}</div>}
          </div>
        </nav>
      )} */}

      {step === "START" && (
        <div
          style={{
            backgroundColor: "#f8f9fc",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Corebridge Header */}
          <header
            style={{
              background: "linear-gradient(90deg, #371861 0%, #1e0936 100%)",
              color: "#fff",
              padding: "16px 40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, #a855f7, #6b21a8)",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "18px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                CB
              </div>
              <div>
                <div
                  style={{
                    fontWeight: "700",
                    fontSize: "16px",
                    letterSpacing: "0.5px",
                  }}
                >
                  Corebridge Financial
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#d8b4fe",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  Policy Center
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "24px",
                fontSize: "13px",
                fontWeight: "600",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  backgroundColor: "#8b5cf6",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  cursor: "pointer",
                }}
              >
                HOME
              </span>
              <span style={{ color: "#d8b4fe", cursor: "pointer" }}>
                SELF-SERVICE
              </span>
              <span style={{ color: "#d8b4fe", cursor: "pointer" }}>
                TRACK REQUEST
              </span>
            </div>
          </header>

          {/* Search Bar Section */}
          <div
            style={{
              background: "linear-gradient(180deg, #1e0936 0%, #3b0764 100%)",
              padding: "50px 20px 60px",
              textAlign: "center",
              color: "#fff",
            }}
          >
            <div
              style={{
                maxWidth: "600px",
                margin: "0 auto 16px",
                position: "relative",
              }}
            >
              <input
                type="text"
                placeholder="Search by policy number, name, or policy type..."
                style={{
                  width: "100%",
                  padding: "14px 100px 14px 20px",
                  borderRadius: "30px",
                  border: "none",
                  outline: "none",
                  fontSize: "14px",
                  color: "#333",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}
                disabled
              />
              <button
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "5px",
                  background: "#6b21a8",
                  color: "#fff",
                  border: "none",
                  borderRadius: "20px",
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "not-allowed",
                }}
              >
                Search
              </button>
            </div>
            <div style={{ fontSize: "12px", color: "#d8b4fe" }}>
              Try: <span style={{ fontWeight: "bold" }}>POL-100234</span>,{" "}
              <span style={{ fontWeight: "bold" }}>Ava Thompson</span>, or{" "}
              <span style={{ fontWeight: "bold" }}>Health Insurance</span>
            </div>
          </div>

          {/* Self-service Content */}
          <div
            style={{
              flexGrow: 1,
              padding: "50px 40px",
              maxWidth: "1200px",
              margin: "0 auto",
              width: "100%",
            }}
          >
            <h2
              style={{
                textAlign: "center",
                color: "#1e1b4b",
                fontSize: "24px",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Self-service, on your terms
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "#6b7280",
                fontSize: "14px",
                marginBottom: "40px",
              }}
            >
              Handle the most common policy requests online, 24/7 — no phone
              calls required.
            </p>

            {/* Grid layout matching Corebridge cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "24px",
                justifyContent: "center",
                alignItems: "stretch",
              }}
            >
              {/* Card 1: Static */}
              <div
                className="card"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  opacity: 0.8,
                }}
              >
                <div
                  style={{
                    backgroundColor: "#a855f7",
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    color: "#fff",
                    marginBottom: "20px",
                  }}
                ></div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: "8px",
                  }}
                >
                  Address Change
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    flexGrow: 1,
                    lineHeight: "1.5",
                    marginBottom: "20px",
                  }}
                >
                  Update the mailing or residential address linked to your
                  policy.
                </p>
                <div
                  style={{
                    color: "#a855f7",
                    fontSize: "12px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  GET STARTED →
                </div>
              </div>

              {/* Card 2: Static */}
              <div
                className="card"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  opacity: 0.8,
                }}
              >
                <div
                  style={{
                    backgroundColor: "#a855f7",
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    color: "#fff",
                    marginBottom: "20px",
                  }}
                ></div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: "8px",
                  }}
                >
                  Death Claim
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    flexGrow: 1,
                    lineHeight: "1.5",
                    marginBottom: "20px",
                  }}
                >
                  Initiate a death claim for a life insurance policy on behalf
                  of a beneficiary.
                </p>
                <div
                  style={{
                    color: "#a855f7",
                    fontSize: "12px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  GET STARTED →
                </div>
              </div>

              {/* Card 3: Active Beneficiary Update */}
              <div
                className="card"
                onClick={init}
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  cursor: "pointer",
                  border: "2px solid #a855f7",
                  boxShadow: "0 10px 20px rgba(168, 85, 247, 0.15)",
                  transform: "translateY(-4px)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#a855f7",
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    color: "#fff",
                    marginBottom: "20px",
                  }}
                ></div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: "8px",
                  }}
                >
                  Respond to requirement
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    flexGrow: 1,
                    lineHeight: "1.5",
                    marginBottom: "20px",
                  }}
                >
                  Add, replace, or update requested claim supporting documents
                  required for claim processing.
                </p>
                <div
                  style={{
                    color: "#a855f7",
                    fontSize: "12px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  GET STARTED →
                </div>
              </div>

              {/* Card 4: Static */}
              <div
                className="card"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  opacity: 0.8,
                }}
              >
                <div
                  style={{
                    backgroundColor: "#a855f7",
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    color: "#fff",
                    marginBottom: "20px",
                  }}
                ></div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: "8px",
                  }}
                >
                  Premium Payment Update
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    flexGrow: 1,
                    lineHeight: "1.5",
                    marginBottom: "20px",
                  }}
                >
                  Change your premium payment method, frequency, or bank
                  details.
                </p>
                <div
                  style={{
                    color: "#a855f7",
                    fontSize: "12px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  GET STARTED →
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stages Bar ─────────────────────────────── */}
      {/* {(step === "COLLECT_REQ" ||
        step === "REVIEW_DOCS" ||
        step === "SUCCESS") && <StagesBar stages={stages} />} */}

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
          <button className="btn btn-primary" onClick={init}>
            Retry
          </button>
        </div>
      )}
      {/* ── Case List ──────────────────────────────── */}
      {step === "CASE_LIST" && (
        <div className="app-body">
          <main
            className="main-content fade-in"
            style={{ maxWidth: 800, margin: "40px auto" }}
          >
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <div className="card-title-icon"></div>
                  Pending Intake Cases
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Select a case to collect and review requirements
                </span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {caseList.length === 0 ? (
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "var(--text-subtle)",
                    }}
                  >
                    No pending cases found for "Collect Additional
                    Requirements".
                  </div>
                ) : (
                  <div className="req-table-wrapper">
                    <table className="req-table">
                      <thead>
                        <tr>
                          <th>Case ID</th>
                          <th>Label</th>
                          <th>Status</th>
                          <th>Urgency</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caseList.map((c, i) => (
                          <tr key={c.pzInsKey || i} className="fade-in">
                            <td style={{ fontWeight: "bold" }}>
                              {c.pxRefObjectInsName ||
                                c.pxRefObjectKey ||
                                c.pxObjRef}
                            </td>
                            <td>
                              {c.pxTaskLabel ||
                                c.pyLabel ||
                                c.pyInstructions ||
                                "Collect Additional Requirements"}
                            </td>
                            <td>
                              <span
                                className="status-pill nigo"
                                style={{ textTransform: "capitalize" }}
                              >
                                {c.pyAssignmentStatus || "New"}
                              </span>
                            </td>
                            <td>{c.pxUrgencyAssign || "0"}</td>
                            <td>
                              <button
                                className="btn btn-primary"
                                style={{ padding: "6px 12px", fontSize: 13 }}
                                onClick={() =>
                                  handleCaseSelect(
                                    c.pxRefObjectKey ||
                                      c.pxRefObjectInsName ||
                                      c.pxObjRef,
                                  )
                                }
                              >
                                Open Case
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ── COLLECT ADDITIONAL REQUIREMENTS / DYNAMIC FORM ─── */}
      {step === "COLLECT_REQ" && (
        <div className="app-body">
          <main className="main-content fade-in">
            {/* Case info bar */}
            {/* <div className="case-info-bar">
              <div className="case-info-left">
                <div className="case-icon"></div>
                <div>
                  <div className="case-title">{caseName}</div>
                  <div className="case-id">
                    {caseId} {businessId && `· ${businessId}`}
                  </div>
                </div>
              </div>
              <div className="case-meta">
                <div className="meta-chip">
                  {" "}
                  <strong>{assignee}</strong>
                </div>
                <div className="meta-chip">
                  {" "}
                  Urgency <strong>{caseUrgency}</strong>
                </div>
                <span className="status-badge">{caseStatus}</span>
              </div>
            </div> */}

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
                  {caseData?.assignments?.[0]?.name ||
                    "Collect Claimant Details"}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {isRequirementListFlow
                    ? "Upload attachments for each requirement"
                    : "Please fill out all the details below"}
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
                {/* {actionButtons?.secondary?.map((btn, i) => {
                  let onClickHandler = null;
                  if (
                    btn.actionID === "fillFormWithAI" ||
                    btn.jsAction === "fillFormWithAI"
                  ) {
                    onClickHandler = handleFillSampleData;
                  } else if (btn.actionID === "save") {
                    onClickHandler = null;
                  } else {
                    onClickHandler = init;
                  }
                  return (
                    <button
                      key={i}
                      className="btn btn-ghost"
                      onClick={onClickHandler}
                    >
                      {btn.name}
                    </button>
                  );
                }) || (
                  <button className="btn btn-ghost" onClick={init}>
                    ↺ Refresh
                  </button>
                )} */}

                {actionButtons?.main?.map((btn, i) => (
                  <button
                    key={i}
                    className="btn btn-primary"
                    onClick={
                      isRequirementListFlow
                        ? handleCollectSubmit
                        : handleDynamicSubmit
                    }
                    disabled={Object.values(uploading).some(Boolean)}
                  >
                    {Object.values(uploading).some(Boolean) ? (
                      <>
                        <div className="btn-spinner" /> Uploading…
                      </>
                    ) : (
                      btn.name
                    )}
                  </button>
                )) || (
                  <button
                    className="btn btn-primary"
                    onClick={
                      isRequirementListFlow
                        ? handleCollectSubmit
                        : handleDynamicSubmit
                    }
                    disabled={Object.values(uploading).some(Boolean)}
                  >
                    {Object.values(uploading).some(Boolean) ? (
                      <>
                        <div className="btn-spinner" /> Uploading…
                      </>
                    ) : (
                      "Submit"
                    )}
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* ── Sidebar ────────────────────────────── */}
          {/* <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section-title"> Case Details</div>
              <div className="sidebar-field">
                <div className="sidebar-label">Case ID</div>
                <div className="sidebar-value">{businessId || caseId}</div>
              </div>
              <div className="sidebar-field">
                <div className="sidebar-label">Type</div>
                <div className="sidebar-value">
                  {caseData?.caseTypeName || "Intake FNOL"}
                </div>
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
                    ? new Date(caseData.createTime).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "short", day: "numeric" },
                      )
                    : "—"}
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title"> Assignment</div>
              <div className="sidebar-field">
                <div className="sidebar-label">Task</div>
                <div className="sidebar-value">
                  {caseData?.assignments?.[0]?.name ||
                    "Collect Claimant Details"}
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
                    {reqRows.filter((r) => r._attachmentId).length} /{" "}
                    {reqRows.length} uploaded
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    height: 6,
                    background: "var(--border)",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--primary)",
                      borderRadius: 99,
                      width: `${reqRows.length ? (reqRows.filter((r) => r._attachmentId).length / reqRows.length) * 100 : 0}%`,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </aside> */}
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
                  <div className="case-title">
                    {caseName} — Review Attached Documents
                  </div>
                  <div className="case-id">
                    {caseId} {businessId && `· ${businessId}`}
                  </div>
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
                <div className="next-assign-name">
                  Review Attached Documents
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  Review and update the requirement details below, then submit.
                </div>
              </div>
            )}

            {error && (
              <div className="error-box">
                <span>✕</span> {error}
              </div>
            )}

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
                      <>
                        <div className="btn-spinner" /> Submitting…
                      </>
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
                      <>
                        <div className="btn-spinner" /> Submitting…
                      </>
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
                  <div className="sidebar-label">
                    {row.Requirement || `Requirement ${i + 1}`}
                  </div>
                  <div className="sidebar-value">
                    <span className={`status-pill ${statusClass(row.Status)}`}>
                      {resolveStatusLabel(row.Status, uiResources)}
                    </span>
                  </div>
                  {row.RequiredAttachment?.pyAttachName && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--success)",
                        marginTop: 3,
                      }}
                    >
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
              Additional requirements are collected and submitted for review .
              <br />
              The case has been updated in Pega.
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => {
                  authRef.current = false;
                  init();
                }}
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
