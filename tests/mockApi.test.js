import { describe, expect, it } from "vitest";
import { handleMockRequest, MOCK_CASE_ID, MOCK_TOKEN } from "../src/mockApi.js";

describe("mock API fallback", () => {
  const authHeaders = { Authorization: `Bearer ${MOCK_TOKEN}` };

  it("issues a mock bearer token for client credentials", async () => {
    const response = await handleMockRequest(
      "https://pega.example.test/prweb/PRRestService/oauth2/v1/token",
      {
        method: "POST",
        body: "grant_type=client_credentials&client_id=test&client_secret=test",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      access_token: MOCK_TOKEN,
      token_type: "Bearer",
      expires_in: 3600,
    });
  });

  it("rejects protected mock endpoints without the mock token", async () => {
    const response = await handleMockRequest(
      "https://pega.example.test/api/data_views/D_GetWorkListOnAssignment",
      { method: "POST" },
    );

    expect(response.status).toBe(401);
  });

  it("returns a mock case worklist", async () => {
    const response = await handleMockRequest(
      "https://pega.example.test/api/data_views/D_GetWorkListOnAssignment",
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          dataViewParameters: { TaskLabel: "Collect Additional Requirements" },
        }),
      },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pxRefObjectKey).toBe(MOCK_CASE_ID);
  });

  it("returns case details and assignment metadata", async () => {
    const caseResponse = await handleMockRequest(
      `https://pega.example.test/api/cases/${MOCK_CASE_ID}?viewType=page`,
      { headers: authHeaders },
    );
    const caseBody = await caseResponse.json();

    const metadataResponse = await handleMockRequest(
      "https://pega.example.test/assignments/MOCK-ASSIGN-1001/actions/CollectAdditionalRequirements?viewType=form",
      { headers: authHeaders },
    );
    const metadataBody = await metadataResponse.json();

    expect(caseResponse.status).toBe(200);
    expect(metadataResponse.status).toBe(200);
    expect(caseBody.data.caseInfo.ID).toBe(MOCK_CASE_ID);
    expect(caseBody.data.caseInfo.assignments[0].ID).toBe("MOCK-ASSIGN-1001");
    expect(metadataBody.uiResources.root.config.name).toBe("MockBeneficiaryForm");
    expect(metadataBody.data.caseInfo.content.ClaimantName).toBe("Ava Thompson");
  });

  it("accepts a PATCH submission and returns the updated form values", async () => {
    const response = await handleMockRequest(
      "https://pega.example.test/assignments/MOCK-ASSIGN-1001/actions/CollectAdditionalRequirements?viewType=form",
      {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          "If-Match": '"mock-etag"',
        },
        body: JSON.stringify({
          content: {
            ClaimantName: "Updated Mock Claimant",
            RelationshipWithInsured: "Son",
          },
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.caseInfo.status).toBe("Resolved");
    expect(body.data.caseInfo.content.ClaimantName).toBe("Updated Mock Claimant");
    expect(body.data.caseInfo.content.RelationshipWithInsured).toBe("Son");
    expect(body.data.caseInfo.assignments).toEqual([]);
  });

  it("provides a local attachment id without contacting a real API", async () => {
    const response = await handleMockRequest(
      "https://pega.example.test/api/attachments/upload",
      {
        method: "POST",
        headers: authHeaders,
      },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ID).toMatch(/^MOCK-ATTACH-/);
  });
});
