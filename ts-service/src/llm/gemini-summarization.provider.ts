import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";

import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  RecommendedDecision,
  SummarizationProvider,
} from "./summarization-provider.interface";

@Injectable()
export class GeminiSummarizationProvider implements SummarizationProvider {
  private readonly logger = new Logger(GeminiSummarizationProvider.name);
  private readonly client: GoogleGenerativeAI;
  private readonly model: string = "gemini-1.5-flash";

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    try {
      const documentsText = input.documents.join("\n---\n");
      const prompt = this.buildPrompt(input.candidateId, documentsText);

      const model = this.client.getGenerativeModel({ model: this.model });
      const response = await model.generateContent(prompt);
      const responseText = response.response.text();

      return this.parseResponse(responseText);
    } catch (error) {
      this.logger.error(
        `Failed to generate summary for candidate ${input.candidateId}`,
        error,
      );
      // Return a safe default on error
      return this.getDefaultResult("API error during summary generation");
    }
  }

  private buildPrompt(candidateId: string, documentsText: string): string {
    return `You are a technical recruiter evaluating a candidate's qualifications. 
Analyze the following documents and provide a structured evaluation in JSON format.

Candidate ID: ${candidateId}

Documents:
${documentsText}

Please respond with a JSON object containing ONLY the following fields (no markdown, no code blocks):
{
  "score": <number between 0-100>,
  "strengths": [<array of 2-3 key strengths as strings>],
  "concerns": [<array of 1-2 concerns as strings>],
  "summary": "<2-3 sentence summary of the candidate>",
  "recommendedDecision": "<one of: 'advance', 'hold', or 'reject'>"
}

Evaluation criteria:
- Score: 0-100 scale based on technical skills, experience, and fit
- Strengths: Key positive attributes from the documents
- Concerns: Any gaps or red flags
- Summary: Concise overview of candidacy
- Decision: advance (strong fit), hold (potential but needs more info), reject (not suitable)

Return ONLY the JSON object, no other text.`;
  }

  private parseResponse(responseText: string): CandidateSummaryResult {
    try {
      // Remove potential markdown code blocks
      let jsonText = responseText.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
      }

      const parsed = JSON.parse(jsonText);

      // Validate and sanitize the response
      return {
        score: this.validateScore(parsed.score),
        strengths: this.validateArray(parsed.strengths, "strengths"),
        concerns: this.validateArray(parsed.concerns, "concerns"),
        summary: this.validateString(parsed.summary, "summary"),
        recommendedDecision: this.validateDecision(parsed.recommendedDecision),
      };
    } catch (error) {
      this.logger.error("Failed to parse Gemini response", {
        error,
        responseText,
      });
      return this.getDefaultResult("Failed to parse response");
    }
  }

  private validateScore(score: unknown): number {
    if (typeof score === "number" && score >= 0 && score <= 100) {
      return score;
    }
    this.logger.warn(`Invalid score received: ${score}, using default 50`);
    return 50;
  }

  private validateArray(arr: unknown, fieldName: string): string[] {
    if (!Array.isArray(arr)) {
      this.logger.warn(`Invalid ${fieldName} - not an array, using default`);
      return fieldName === "strengths"
        ? ["Unable to determine strengths"]
        : ["Further evaluation needed"];
    }
    return arr
      .filter((item) => typeof item === "string" && item.length > 0)
      .slice(0, 10); // Limit to 10 items
  }

  private validateString(str: unknown, fieldName: string): string {
    if (typeof str === "string" && str.length > 0) {
      return str.substring(0, 500); // Limit to 500 chars
    }
    this.logger.warn(`Invalid ${fieldName} - not a string, using default`);
    return "Unable to generate summary";
  }

  private validateDecision(decision: unknown): RecommendedDecision {
    const validDecisions: RecommendedDecision[] = ["advance", "hold", "reject"];
    if (
      typeof decision === "string" &&
      validDecisions.includes(decision as RecommendedDecision)
    ) {
      return decision as RecommendedDecision;
    }
    this.logger.warn(
      `Invalid decision received: ${decision}, defaulting to 'hold'`,
    );
    return "hold";
  }

  private getDefaultResult(reason: string): CandidateSummaryResult {
    this.logger.warn(`Returning default result due to: ${reason}`);
    return {
      score: 50,
      strengths: ["Requires manual review"],
      concerns: ["Unable to auto-generate summary"],
      summary: `Automatic evaluation could not be completed (${reason}). Please review documents manually.`,
      recommendedDecision: "hold",
    };
  }
}
