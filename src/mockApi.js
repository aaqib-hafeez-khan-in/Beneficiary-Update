const MOCK_TOKEN = "mock-access-token-beneficiary-update";
const MOCK_CASE_ID = "MOCK-BEN-1001";
const MOCK_ASSIGNMENT_ID = "MOCK-ASSIGN-1001";
const MOCK_ACTION_ID = "CollectAdditionalRequirements";

const mockFormContent = {
  ClaimantName: "Ava Thompson",
  ClaimantType: "Nominee",
  RelationshipWithInsured: "Daughter",
  ClaimantEmailID: "ava.thompson@example.com",
  ClaimantContactNumber: "2025550143",
};

const mockCaseInfo = () => ({
  ID: MOCK_CASE_ID,
  name: "Mock Beneficiary Update",
  status: "Open",
  urgency: 10,
  stageLabel: "Collect Additional Requirements",
  stages: [
    { ID: "1", name: "Collect Additional Requirements", visited_status: "active" },
    { ID: "2", name: "Review Documents", visited_status: "pending" },
  ],
  assignments: [
    {
      ID: MOCK_ASSIGNMENT_ID,
      name: "Collect Claimant Details",
      processID: "CollectRequirements_Flow",
      actions: [{ ID: MOCK_ACTION_ID }],
      assigneeInfo: { name: "Mock User" },
    },
  ],
  content: { ...mockFormContent },
});

const mockAssignmentResponse = (content = mockFormContent) => ({
  data: { caseInfo: { ...mockCaseInfo(), content: { ...content } } },
  uiResources: {
    resources: {
      fields: {
        ClaimantName: [{ label: "Claimant Name" }],
        ClaimantType: [
          {
            label: "Claimant Type",
            datasource: {
              records: [
                { key: "Nominee", value: "Nominee" },
                { key: "Legal Heir", value: "Legal Heir" },
                { key: "Executor", value: "Executor" },
              ],
            },
          },
        ],
        RelationshipWithInsured: [
          {
            label: "Relationship With Insured",
            datasource: {
              records: [
                { key: "Spouse", value: "Spouse" },
                { key: "Father", value: "Father" },
                { key: "Mother", value: "Mother" },
                { key: "Daughter", value: "Daughter" },
                { key: "Son", value: "Son" },
              ],
            },
          },
        ],
        ClaimantEmailID: [{ label: "Email" }],
        ClaimantContactNumber: [{ label: "Contact Number" }],
      },
      views: {
        MockBeneficiaryForm: [
          {
            children: [
              {
                type: "Group",
                config: {
                  id: "claimant",
                  showHeading: true,
                  heading: "Claimant Details",
                },
                children: [
                  {
                    type: "TextInput",
                    name: "ClaimantName",
                    config: { value: "@P .ClaimantName" },
                  },
                  {
                    type: "Dropdown",
                    name: "ClaimantType",
                    config: { value: "@P .ClaimantType" },
                  },
                  {
                    type: "Dropdown",
                    name: "RelationshipWithInsured",
                    config: { value: "@P .RelationshipWithInsured" },
                  },
                  {
                    type: "Email",
                    name: "ClaimantEmailID",
                    config: { value: "@P .ClaimantEmailID" },
                  },
                  {
                    type: "Phone",
                    name: "ClaimantContactNumber",
                    config: { value: "@P .ClaimantContactNumber" },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    root: { config: { name: "MockBeneficiaryForm" } },
    actionButtons: null,
  },
});

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const getRequestMethod = (input, options) =>
  (options.method || (typeof input !== "string" ? input.method : "GET")).toUpperCase();

const getRequestHeaders = (input, options) => {
  if (options.headers) return new Headers(options.headers);
  if (typeof input !== "string" && input.headers) return new Headers(input.headers);
  return new Headers();
};

const requireMockToken = (input, options) => {
  const authorization = getRequestHeaders(input, options).get("Authorization") || "";
  if (authorization !== `Bearer ${MOCK_TOKEN}`) {
    return jsonResponse({ message: "Mock authentication failed" }, 401);
  }
  return null;
};

export const createMockFetch = () => async (input, options = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = getRequestMethod(input, options);

  if (url.includes("/oauth2/") || url.endsWith("/token")) {
    const requestBody =
      options.body || (typeof input !== "string" ? await input.clone().text() : "");
    const params = new URLSearchParams(requestBody);
    if (method !== "POST" || params.get("grant_type") !== "client_credentials") {
      return jsonResponse({ message: "Mock token endpoint expects POST client_credentials" }, 400);
    }
    return jsonResponse({
      access_token: MOCK_TOKEN,
      token_type: "Bearer",
      expires_in: 3600,
    });
  }

  const authError = requireMockToken(input, options);
  if (authError) return authError;

  if (url.includes("D_GetWorkListOnAssignment")) {
    return jsonResponse({
      data: [
        {
          pxRefObjectKey: MOCK_CASE_ID,
          pxRefObjectInsName: MOCK_CASE_ID,
          pxTaskLabel: "Collect Additional Requirements",
          pyAssignmentStatus: "New",
          pxUrgencyAssign: "10",
        },
      ],
    });
  }

  if (method === "GET" && new URL(url, globalThis.location?.origin || "http://localhost").pathname.includes("/cases/")) {
    return jsonResponse({ data: { caseInfo: mockCaseInfo() } });
  }

  if (url.includes(`/assignments/${MOCK_ASSIGNMENT_ID}/actions/${MOCK_ACTION_ID}`) && method === "GET") {
    return jsonResponse(mockAssignmentResponse(), 200, { ETag: '"mock-etag"' });
  }

  if (url.includes("/attachments/upload") && method === "POST") {
    return jsonResponse({ ID: `MOCK-ATTACH-${Date.now()}` }, 201);
  }

  if (url.includes(`/assignments/${MOCK_ASSIGNMENT_ID}/actions/${MOCK_ACTION_ID}`) && method === "PATCH") {
    let payload = {};
    try {
      const body = options.body || (typeof input !== "string" ? await input.clone().text() : "{}");
      payload = typeof body === "string" ? JSON.parse(body) : {};
    } catch {
      payload = {};
    }

    return jsonResponse({
      ...mockAssignmentResponse({ ...mockFormContent, ...(payload.content || {}) }),
      data: {
        caseInfo: {
          ...mockCaseInfo(),
          status: "Resolved",
          assignments: [],
          content: { ...mockFormContent, ...(payload.content || {}) },
        },
      },
    });
  }

  return jsonResponse(
    { message: `Mock endpoint not implemented: ${method} ${url}` },
    404,
  );
};

export { MOCK_TOKEN, MOCK_CASE_ID };
