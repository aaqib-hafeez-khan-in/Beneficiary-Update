const MOCK_TOKEN = "mock-access-token-beneficiary-update";
const MOCK_CASE_ID = "MOCK-BEN-1001";

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
      ID: "MOCK-ASSIGN-1001",
      name: "Collect Claimant Details",
      processID: "CollectRequirements_Flow",
      actions: [{ ID: "CollectAdditionalRequirements" }],
      assigneeInfo: { name: "Mock User" },
    },
  ],
  content: { ...mockFormContent },
});

const mockAssignmentResponse = () => ({
  data: { caseInfo: mockCaseInfo() },
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

export const createMockFetch = () => async (input, options = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = (
    options.method || (typeof input !== "string" ? input.method : "GET")
  ).toUpperCase();

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
    return jsonResponse({ data: { caseInfo: mockCaseInfo() } });
  }

  if (url.includes("/assignments/") && method === "GET") {
    return jsonResponse(mockAssignmentResponse(), 200, { ETag: '"mock-etag"' });
  }

  if (url.includes("/attachments/upload") && method === "POST") {
    return jsonResponse({ ID: `MOCK-ATTACH-${Date.now()}` });
  }

  if (url.includes("/assignments/") && method === "PATCH") {
    return jsonResponse({
      data: {
        caseInfo: {
          ...mockCaseInfo(),
          status: "Resolved",
          assignments: [],
          content: { ...mockFormContent },
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
