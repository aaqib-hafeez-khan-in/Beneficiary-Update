const MOCK_MODE = String(import.meta.env.VITE_MOCK_MODE || "false").toLowerCase() === "true";

const originalFetch = globalThis.fetch?.bind(globalThis);
const MOCK_TOKEN = "mock-access-token-beneficiary-update";
const MOCK_CASE_ID = "MOCK-CASE-1001";
const MOCK_ASSIGNMENT_ID = "MOCK-ASG-1001";
const MOCK_ACTION_ID = "CollectClaimantDetails";

const mockHeaders = (extra = {}) =>
  new Headers({
    "Content-Type": "application/json",
    ...extra,
  });

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: mockHeaders(headers),
  });

const requireMockToken = (request) => {
  const authorization = request.headers.get("Authorization") || "";
  if (authorization !== `Bearer ${MOCK_TOKEN}`) {
    return jsonResponse({ message: "Mock authentication failed" }, 401);
  }
  return null;
};

const mockCaseList = {
  data: [
    {
      pzInsKey: MOCK_CASE_ID,
      pxRefObjectInsName: MOCK_CASE_ID,
      pxRefObjectKey: MOCK_CASE_ID,
      pxObjRef: MOCK_CASE_ID,
      pxTaskLabel: "Collect Additional Requirements",
      pyLabel: "Beneficiary Update",
      pyAssignmentStatus: "New",
      pxUrgencyAssign: 10,
    },
  ],
};

const mockCaseInfo = {
  ID: MOCK_CASE_ID,
  name: "Beneficiary Update",
  status: "Open",
  urgency: 10,
  stageLabel: "Collect Additional Requirements",
  businessId: "MOCK-BEN-1001",
  stages: [
    { ID: "stage-1", name: "Case Intake", visited_status: "completed" },
    { ID: "stage-2", name: "Collect Additional Requirements", visited_status: "active" },
    { ID: "stage-3", name: "Review", visited_status: "pending" },
  ],
  assignments: [
    {
      ID: MOCK_ASSIGNMENT_ID,
      name: "Collect Claimant Details",
      processID: "BeneficiaryUpdate_Flow",
      assigneeInfo: { name: "Mock Claims Team" },
      actions: [{ ID: MOCK_ACTION_ID, name: "Submit" }],
    },
  ],
  content: {
    ClaimantName: "Ava Thompson",
    ClaimantType: "Nominee",
    RelationshipWithInsured: "Daughter",
    pyCallingCode: "+1",
    ClaimantContactNumber: "2025550143",
    ClaimantEmailID: "ava.thompson@example.com",
    ClaimantDOB: "1994-08-04",
    ClaimantAddressLine1: "123 Innovation Way",
    ClaimantPostalCode: 10001,
    ClaimantIdentificationNumber: 846667806,
  },
};

const mockUiResources = {
  fields: {
    ClaimantName: [{ label: "Claimant Name" }],
    ClaimantType: [{
      label: "Claimant Type",
      datasource: {
        tableType: "PromptList",
        records: [
          { key: "Nominee", value: "Nominee" },
          { key: "Legal Heir", value: "Legal Heir" },
          { key: "Executor", value: "Executor" },
        ],
      },
    }],
    RelationshipWithInsured: [{
      label: "Relationship With Insured",
      datasource: {
        tableType: "PromptList",
        records: [
          { key: "Spouse", value: "Spouse" },
          { key: "Father", value: "Father" },
          { key: "Mother", value: "Mother" },
          { key: "Daughter", value: "Daughter" },
          { key: "Son", value: "Son" },
        ],
      },
    }],
    pyCallingCode: [{
      label: "Calling Code",
      datasource: {
        tableType: "PromptList",
        records: [
          { key: "+1", value: "+1" },
          { key: "+91", value: "+91" },
          { key: "+44", value: "+44" },
        ],
      },
    }],
    ClaimantContactNumber: [{ label: "Contact Number" }],
    ClaimantEmailID: [{ label: "Email Address" }],
    ClaimantDOB: [{ label: "Date of Birth" }],
    ClaimantAddressLine1: [{ label: "Address" }],
    ClaimantPostalCode: [{ label: "Postal Code" }],
    ClaimantIdentificationNumber: [{ label: "Identification Number" }],
  },
  views: {
    MockClaimantDetails: [{
      name: "MockClaimantDetails",
      type: "View",
      children: [{
        type: "Group",
        config: { id: "mock-claimant", showHeading: true, heading: "Claimant Details" },
        children: [
          { type: "TextInput", config: { value: "@P .ClaimantName", label: "@L Claimant Name" } },
          { type: "Dropdown", config: { value: "@P .ClaimantType", label: "@L Claimant Type" } },
          { type: "Dropdown", config: { value: "@P .RelationshipWithInsured", label: "@L Relationship With Insured" } },
          { type: "Phone", config: { value: "@P .ClaimantContactNumber", label: "@L Contact Number" } },
          { type: "Email", config: { value: "@P .ClaimantEmailID", label: "@L Email Address" } },
          { type: "Date", config: { value: "@P .ClaimantDOB", label: "@L Date of Birth" } },
          { type: "TextInput", config: { value: "@P .ClaimantAddressLine1", label: "@L Address" } },
          { type: "Integer", config: { value: "@P .ClaimantPostalCode", label: "@L Postal Code" } },
          { type: "Integer", config: { value: "@P .ClaimantIdentificationNumber", label: "@L Identification Number" } },
        ],
      }],
    }],
  },
};

const assignmentResponse = (content = mockCaseInfo.content) => ({
  uiResources: {
    resources: mockUiResources,
    root: { config: { name: "MockClaimantDetails" } },
    actionButtons: { primary: [{ actionID: MOCK_ACTION_ID, label: "Submit" }] },
  },
  data: {
    caseInfo: { ...mockCaseInfo, content },
  },
});

const readJson = async (request) => {
  try {
    return await request.clone().json();
  } catch {
    return null;
  }
};

const handleMockRequest = async (input, init = {}) => {
  const request = new Request(input, init);
  const baseUrl = globalThis.location?.origin || "http://localhost";
  const url = new URL(request.url, baseUrl);
  const path = url.pathname;

  if (path.includes("oauth2/v1/token")) {
    const body = await request.clone().text();
    const params = new URLSearchParams(body);
    if (params.get("grant_type") !== "client_credentials") {
      return jsonResponse({ message: "Mock token endpoint expects client_credentials" }, 400);
    }
    return jsonResponse({
      access_token: MOCK_TOKEN,
      token_type: "Bearer",
      expires_in: 3600,
    });
  }

  const authError = requireMockToken(request);
  if (authError) return authError;

  if (path.endsWith("/D_GetWorkListOnAssignment")) return jsonResponse(mockCaseList);

  if (path.includes(`/cases/${encodeURIComponent(MOCK_CASE_ID)}`)) {
    return jsonResponse({ data: { caseInfo: mockCaseInfo } });
  }

  if (path.endsWith("/attachments/upload") && request.method === "POST") {
    return jsonResponse({ ID: `MOCK-ATTACH-${Date.now()}` }, 201);
  }

  if (path.includes(`/assignments/${MOCK_ASSIGNMENT_ID}/actions/`)) {
    if (request.method === "GET") {
      return new Response(JSON.stringify(assignmentResponse()), {
        status: 200,
        headers: mockHeaders({ ETag: '"mock-v1"' }),
      });
    }

    if (request.method === "PATCH") {
      const payload = (await readJson(request)) || {};
      const nextContent = { ...mockCaseInfo.content, ...(payload.content || {}) };
      return new Response(JSON.stringify(assignmentResponse(nextContent)), {
        status: 200,
        headers: mockHeaders({ "If-Match": '"mock-v2"', ETag: '"mock-v2"' }),
      });
    }
  }

  return jsonResponse({ message: `Mock API endpoint not implemented for ${request.method} ${path}` }, 404);
};

if (MOCK_MODE) {
  globalThis.fetch = handleMockRequest;
  console.info("[Beneficiary Update] MOCK MODE enabled: API calls are being served locally.");
}

export { MOCK_MODE, MOCK_TOKEN, handleMockRequest };
