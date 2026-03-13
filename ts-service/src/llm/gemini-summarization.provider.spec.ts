import { GeminiSummarizationProvider } from "./gemini-summarization.provider";
import {
  CandidateSummaryInput,
  CandidateSummaryResult,
} from "./summarization-provider.interface";

// Mock the Google Generative AI module
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

import { GoogleGenerativeAI } from "@google/generative-ai";

describe("GeminiSummarizationProvider", () => {
  let provider: GeminiSummarizationProvider;
  let mockGenerativeAI: any;
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerativeAI = GoogleGenerativeAI as jest.MockedClass<
      typeof GoogleGenerativeAI
    >;
    provider = new GeminiSummarizationProvider("test-api-key");
  });

  describe("generateCandidateSummary", () => {
    it("should parse and return valid response from Gemini API", async () => {
      const mockResponse: CandidateSummaryResult = {
        score: 85,
        strengths: ["Strong technical background", "Good communication"],
        concerns: ["Limited leadership experience"],
        summary: "Solid engineer with room for growth.",
        recommendedDecision: "advance",
      };

      mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-123",
        documents: ["Resume text", "Cover letter text"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(result).toEqual(mockResponse);
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("should handle markdown-wrapped JSON response", async () => {
      const mockResponse: CandidateSummaryResult = {
        score: 75,
        strengths: ["Technical skills"],
        concerns: ["Needs experience"],
        summary: "Promising candidate.",
        recommendedDecision: "hold",
      };

      const jsonResponse = `\`\`\`json
${JSON.stringify(mockResponse)}
\`\`\``;

      mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => jsonResponse,
        },
      });

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-456",
        documents: ["Document 1"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(result).toEqual(mockResponse);
    });

    it("should validate and correct invalid score", async () => {
      const mockResponse = {
        score: 150, // Invalid: > 100
        strengths: ["Strength 1"],
        concerns: ["Concern 1"],
        summary: "Test summary",
        recommendedDecision: "advance",
      };

      mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-789",
        documents: ["Doc"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(result.score).toBe(50); // Default value for invalid score
    });

    it("should validate and correct invalid decision", async () => {
      const mockResponse = {
        score: 70,
        strengths: ["Strength 1"],
        concerns: ["Concern 1"],
        summary: "Test summary",
        recommendedDecision: "maybe", // Invalid decision
      };

      mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-999",
        documents: ["Doc"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(result.recommendedDecision).toBe("hold"); // Default value
    });

    it("should handle malformed JSON gracefully", async () => {
      mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => "This is not JSON",
        },
      });

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-bad",
        documents: ["Doc"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(result.score).toBe(50);
      expect(result.recommendedDecision).toBe("hold");
      expect(result.summary).toContain(
        "Automatic evaluation could not be completed",
      );
    });

    it("should handle API errors gracefully", async () => {
      mockGenerateContent = jest.fn().mockRejectedValue(new Error("API Error"));

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-error",
        documents: ["Doc"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(result.score).toBe(50);
      expect(result.recommendedDecision).toBe("hold");
      expect(result.summary).toContain("API error");
    });

    it("should validate arrays correctly", async () => {
      const mockResponse = {
        score: 80,
        strengths: "not-an-array", // Invalid: not array
        concerns: ["Valid concern"],
        summary: "Test",
        recommendedDecision: "advance",
      };

      mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-arr",
        documents: ["Doc"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(Array.isArray(result.strengths)).toBe(true);
      expect(result.strengths[0]).toBe("Unable to determine strengths");
    });

    it("should truncate long strings", async () => {
      const mockResponse = {
        score: 80,
        strengths: ["Strength"],
        concerns: ["Concern"],
        summary: "a".repeat(600), // > 500 chars
        recommendedDecision: "advance",
      };

      mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const mockModel = {
        generateContent: mockGenerateContent,
      };

      mockGenerativeAI.mock.results[0].value.getGenerativeModel.mockReturnValue(
        mockModel,
      );

      const input: CandidateSummaryInput = {
        candidateId: "cand-long",
        documents: ["Doc"],
      };

      const result = await provider.generateCandidateSummary(input);

      expect(result.summary.length).toBeLessThanOrEqual(500);
    });
  });
});
