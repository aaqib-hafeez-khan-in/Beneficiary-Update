const MOCK_TOKEN = "mock-access-token-beneficiary-update";
const MOCK_CASE_ID = "MOCK-BEN-1001";

const mockRequirementRows = [
  {
    Requirement: "Proof of identity",
    RequirementDescription: "Government-issued identity document",
    Status: "IGO",
    RequiredAttachment: null,
  },
  {
    Requirement: "Proof of relationship",
    RequirementDescription: "Document confirming beneficiary relationship",
    Status: "IGO",
    RequiredAttachment: null,
  },
];

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const getMockCaseInfo = () => ({
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
      ID: "MOCK-ASSIGN-1001",
      name: "Collect Claimant Details",
      processID: "CollectRequirements_Flow",
      actions: [{ ID: "CollectAdditionalRequirements" }],
      assigneeInfo: { name: "Mock User" },
    },
  ],
  content: {
    RequirementLists: mockRequirementRows.map((row) => ({ ...row })),
  },
});

const mockAssignmentResponse = () => ({
  data: {
    caseInfo: getMockCaseInfo(),
  },
  uiResources: {
    resources: {
      fields: {
        Status: [
          {
            datasource: {
              records: [
                { key: "IGO", value: "Pending" },
                { key: "NIGO", value: "Completed" },
              ],
            },
          },
        ],
      },
      views: {},
    },
    root: { config: { name: "" } },
    actionButtons: null,
  },
});

export const createMockFetch = () => {
  return async (input, options = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (options.method || (typeof input !== "string" ? input.method : "GET"))
      .toUpperCase();

    if (url.includes("/oauth2/") || url.endsWith("/token")) {
      return jsonResponse({
        access_token: MOCK_TOKEN,
        token_type: "Bearer",
        expires_in: 3600,
      });
    }

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

    if (method === "GET" && /\/cases\//.test(url)) {
      return jsonResponse({ data: { caseInfo: getMockCaseInfo() } });
    }

    if (url.includes("/attachments/upload") && method === "POST") {
      return jsonResponse({ ID: `MOCK-ATTACH-${Date.now()}` });
    }

    if (url.includes("/assignments/") && method === "GET") {
      return jsonResponse(mockAssignmentResponse(), 200, { ETag: '"mock-etag"' });
    }

    if (url.includes("/assignments/") && method === "PATCH") {
      return jsonResponse({
        data: {
          caseInfo: {
            ...getMockCaseInfo(),
            status: "Submitted",
            assignments: [],
            content: { RequirementLists: [] },
          },
        },
      });
    }

    return jsonResponse({ message: `Mock endpoint not implemented: ${method} ${url}` }, 404);
  };
};

export { MOCK_TOKEN, MOCK_CASE_ID };
