import { describe, expect, it } from "vitest";
import { createMockFetch, MOCK_CASE_ID, MOCK_TOKEN } from "../src/mockApi.js";

describe("mock Pega API", () => {
  it("returns an OAuth-style bearer token", async () => {
    const fetchMock = createMockFetch();
    const response = await fetchMock("https://mock.example/oauth2/v1/token", {
      method: "POST",
      body: "grant_type=client_credentials",
    });

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      access_token: MOCK_TOKEN,
      token_type: "Bearer",
    });
  });

  it("returns a worklist case", async () => {
    const fetchMock = createMockFetch();
    const response = await fetchMock(
      "https://mock.example/data_views/D_GetWorkListOnAssignment",
      { method: "POST" },
    );
    const body = await response.json();

    expect(response.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pxRefObjectKey).toBe(MOCK_CASE_ID);
  });

  it("returns case details and assignment metadata", async () => {
    const fetchMock = createMockFetch();
    const caseResponse = await fetchMock(
      `https://mock.example/cases/${MOCK_CASE_ID}?viewType=page`,
    );
    const caseBody = await caseResponse.json();
    const assignmentResponse = await fetchMock(
      "https://mock.example/assignments/MOCK-ASSIGN-1001/actions/CollectAdditionalRequirements?viewType=form",
    );
    const assignmentBody = await assignmentResponse.json();

    expect(caseBody.data.caseInfo.ID).toBe(MOCK_CASE_ID);
    expect(caseBody.data.caseInfo.assignments[0].ID).toBe("MOCK-ASSIGN-1001");
    expect(assignmentBody.uiResources.root.config.name).toBe("MockBeneficiaryForm");
    expect(assignmentBody.data.caseInfo.content.ClaimantName).toBe("Ava Thompson");
  });

  it("accepts attachment uploads", async () => {
    const fetchMock = createMockFetch();
    const response = await fetchMock("https://mock.example/attachments/upload", {
      method: "POST",
      body: new FormData(),
    });
    const body = await response.json();

    expect(response.ok).toBe(true);
    expect(body.ID).toMatch(/^MOCK-ATTACH-/);
  });

  it("returns a resolved case after submission", async () => {
    const fetchMock = createMockFetch();
    const response = await fetchMock(
      "https://mock.example/assignments/MOCK-ASSIGN-1001/actions/CollectAdditionalRequirements?viewType=form",
      { method: "PATCH", body: JSON.stringify({ content: {} }) },
    );
    const body = await response.json();

    expect(response.ok).toBe(true);
    expect(body.data.caseInfo.status).toBe("Resolved");
    expect(body.data.caseInfo.assignments).toEqual([]);
  });

  it("returns 404 for unknown endpoints", async () => {
    const fetchMock = createMockFetch();
    const response = await fetchMock("https://mock.example/unknown");

    expect(response.status).toBe(404);
  });
});
