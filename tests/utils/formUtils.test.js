import { describe, expect, it } from "vitest";
import {
  encodeId,
  getFieldLabel,
  getFieldMeta,
  getFieldOptions,
  handleApiResponse,
  normalizeReqRow,
  resolveOptions,
  resolveStatusLabel,
  statusClass,
} from "../../src/utils/formUtils.js";

describe("formUtils", () => {
  describe("encodeId", () => {
    it("encodes spaces and reserved characters", () => {
      expect(encodeId("CASE 123/ABC")).toBe("CASE%20123%2FABC");
    });
  });

  describe("statusClass", () => {
    it("maps NIGO to nigo", () => expect(statusClass("NIGO")).toBe("nigo"));
    it("maps IGO to igo", () => expect(statusClass("IGO")).toBe("igo"));
    it("uses ordered for other statuses", () => {
      expect(statusClass("Ordered")).toBe("ordered");
      expect(statusClass()).toBe("ordered");
    });
  });

  describe("resolveStatusLabel", () => {
    const resources = {
      fields: {
        Status: [{ datasource: { records: [{ key: "IGO", value: "In Good Order" }] } }],
      },
    };

    it("resolves a configured status", () => {
      expect(resolveStatusLabel("IGO", resources)).toBe("In Good Order");
    });

    it("falls back to the key", () => {
      expect(resolveStatusLabel("NIGO", resources)).toBe("NIGO");
      expect(resolveStatusLabel(undefined, resources)).toBe("—");
    });
  });

  describe("field metadata", () => {
    const resources = {
      fields: {
        ClaimantName: [{ label: "Claimant Name" }],
      },
    };

    it("returns metadata for an existing field", () => {
      expect(getFieldMeta(resources, "ClaimantName")).toEqual({ label: "Claimant Name" });
    });

    it("returns an empty object for a missing field", () => {
      expect(getFieldMeta({}, "Unknown")).toEqual({});
    });

    it("prefers configured labels and supports fallback labels", () => {
      expect(getFieldLabel(resources, "ClaimantName", "Fallback")).toBe("Claimant Name");
      expect(getFieldLabel({}, "ClaimantName", "Fallback")).toBe("Fallback");
    });
  });

  describe("getFieldOptions", () => {
    it("maps datasource values", () => {
      const resources = {
        fields: {
          Relationship: [{ datasource: { records: [{ key: "S", value: "Spouse" }, { key: "F" }] } }],
        },
      };
      expect(getFieldOptions(resources, "Relationship")).toEqual(["Spouse", "F"]);
    });

    it("uses the fallback list when no records exist", () => {
      expect(getFieldOptions({}, "Relationship", ["Spouse"])).toEqual(["Spouse"]);
    });
  });

  describe("resolveOptions", () => {
    it("resolves PromptList records", () => {
      const resources = {
        fields: {
          ClaimantType: [{ datasource: { tableType: "PromptList", records: [{ key: "N", value: "Nominee" }] } }],
        },
      };
      expect(resolveOptions("ClaimantType", {}, resources, {})).toEqual([
        { label: "Nominee", value: "N" },
      ]);
    });

    it("resolves datasource API results", () => {
      const config = {
        datasource: {
          source: "@DATASOURCE Countries.pxResults",
          fields: { value: "@P .pyName" },
        },
      };
      const apiData = { Countries: { pxResults: [{ pyName: "India" }, { pyName: "Japan" }] } };
      expect(resolveOptions("Country", config, {}, apiData)).toEqual([
        { label: "India", value: "India" },
        { label: "Japan", value: "Japan" },
      ]);
    });

    it("returns configured ClaimantType fallback options", () => {
      expect(resolveOptions("ClaimantType", {}, {}, {})).toEqual([
        { label: "Nominee", value: "Nominee" },
        { label: "Legal Heir", value: "Legal Heir" },
        { label: "Executor", value: "Executor" },
      ]);
    });

    it("returns an empty list when no options can be resolved", () => {
      expect(resolveOptions("Unknown", {}, {}, {})).toEqual([]);
    });
  });

  describe("normalizeReqRow", () => {
    it("returns a shallow copy without mutating the input", () => {
      const row = { id: 1, status: "IGO" };
      const normalized = normalizeReqRow(row);
      expect(normalized).toEqual(row);
      expect(normalized).not.toBe(row);
    });
  });

  describe("handleApiResponse", () => {
    it("returns JSON for successful responses", async () => {
      const response = { ok: true, json: async () => ({ success: true }) };
      await expect(handleApiResponse(response, "Request failed")).resolves.toEqual({ success: true });
    });

    it("uses localizedValue and error detail", async () => {
      const response = {
        ok: false,
        json: async () => ({ localizedValue: "Invalid request", errorDetails: [{ localizedValue: "Missing field" }] }),
      };
      await expect(handleApiResponse(response, "Request failed")).rejects.toThrow(
        "Invalid request: Missing field",
      );
    });

    it("uses message when localizedValue is absent", async () => {
      const response = { ok: false, json: async () => ({ message: "Server error" }) };
      await expect(handleApiResponse(response, "Request failed")).rejects.toThrow("Server error");
    });

    it("falls back to response text when JSON parsing fails", async () => {
      const response = {
        ok: false,
        json: async () => {
          throw new Error("not json");
        },
        text: async () => "Bad gateway",
      };
      await expect(handleApiResponse(response, "Request failed")).rejects.toThrow("Bad gateway");
    });

    it("uses the default error when no response body is available", async () => {
      const response = {
        ok: false,
        json: async () => {
          throw new Error("not json");
        },
        text: async () => "",
      };
      await expect(handleApiResponse(response, "Request failed")).rejects.toThrow("Request failed");
    });
  });
});
