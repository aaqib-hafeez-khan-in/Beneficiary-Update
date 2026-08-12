export const encodeId = (id) => encodeURIComponent(id);

export const statusClass = (status = "") => {
  if (status === "NIGO") return "nigo";
  if (status === "IGO") return "igo";
  return "ordered";
};

export const resolveStatusLabel = (key, uiResources) => {
  const records = uiResources?.fields?.Status?.[0]?.datasource?.records;
  if (!records || !key) return key || "—";
  const match = records.find((record) => record.key === key);
  return match ? match.value : key;
};

export const getFieldMeta = (uiResources, fieldId) => {
  const fields = uiResources?.fields || {};
  return fields[fieldId]?.[0] || {};
};

export const getFieldLabel = (uiResources, fieldId, fallback) => {
  const meta = getFieldMeta(uiResources, fieldId);
  return meta.label || fallback || fieldId;
};

export const getFieldOptions = (uiResources, fieldId, fallbackList = []) => {
  const meta = getFieldMeta(uiResources, fieldId);
  const records = meta.datasource?.records;
  if (Array.isArray(records)) {
    return records.map((record) => record.value || record.key);
  }
  return fallbackList;
};

export const resolveOptions = (fieldId, fieldConfig, uiResources, apiData) => {
  const meta = getFieldMeta(uiResources, fieldId);

  if (
    meta.datasource?.tableType === "PromptList" &&
    Array.isArray(meta.datasource.records)
  ) {
    return meta.datasource.records.map((record) => ({
      label: record.value || record.key,
      value: record.key,
    }));
  }

  const datasource = fieldConfig?.datasource;
  if (datasource && typeof datasource === "object" && datasource.source) {
    const match = datasource.source.match(/@DATASOURCE\s+([\w_]+)\.pxResults/);
    if (match) {
      const dataPageName = match[1];
      const results =
        apiData?.[dataPageName]?.pxResults ||
        apiData?.shared?.[dataPageName]?.[dataPageName]?.pxResults ||
        apiData?.shared?.[dataPageName]?.pxResults;

      if (Array.isArray(results)) {
        const valueProperty =
          datasource.fields?.value?.replace(/^@P \./, "") || "pyCallingCode";
        return results.map((item) => ({
          label: item[valueProperty] || item.pyCallingCode || "",
          value: item[valueProperty] || item.pyCallingCode || "",
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

export const normalizeReqRow = (row) => ({ ...row });

export const handleApiResponse = async (response, defaultErrorMsg) => {
  if (response.ok) return response.json();

  let errorMsg = defaultErrorMsg;

  try {
    const errorJson = await response.json();
    if (errorJson?.localizedValue) {
      errorMsg = errorJson.localizedValue;
      if (errorJson.errorDetails?.[0]?.localizedValue) {
        errorMsg += `: ${errorJson.errorDetails[0].localizedValue}`;
      }
    } else if (errorJson?.message) {
      errorMsg = errorJson.message;
    }
  } catch {
    try {
      const text = await response.text();
      if (text) errorMsg = text;
    } catch {
      // Keep the default error message.
    }
  }

  throw new Error(errorMsg);
};
