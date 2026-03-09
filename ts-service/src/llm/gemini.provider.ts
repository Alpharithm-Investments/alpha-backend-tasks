import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SummarizationProvider,
  CandidateSummaryInput,
  CandidateSummaryResult,
  RecommendedDecision,
} from './summarization-provider.interface';

@Injectable()
export class GeminiProvider implements SummarizationProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string | undefined;
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
  }

  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Combine all documents into formatted text
    const combinedText = input.documents.join('\n\n---\n\n');

    const prompt = this.buildPrompt(input.candidateId, combinedText);

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error('Empty response from Gemini API');
      }

      return this.parseStructuredOutput(generatedText);
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error}`);
      throw error;
    }
  }

  private buildPrompt(candidateId: string, documentText: string): string {
    return `You are an expert recruiter analyzing candidate documents. Review the following documents for candidate "${candidateId}" and provide a structured assessment.

DOCUMENTS:
${documentText}

Provide your response in this exact JSON format:
{
  "score": <number between 0-10>,
  "strengths": [<array of 2-4 key strengths>],
  "concerns": [<array of 0-3 potential concerns or empty array>],
  "summary": "<brief 2-3 sentence overall summary>",
  "recommendedDecision": "<one of: advance, hold, reject>"
}

Decision meanings:
- "advance": Strong candidate, move forward in process
- "hold": Potential but needs more evaluation or follow-up
- "reject": Does not meet requirements

Be objective and base your assessment strictly on the provided documents.`;
  }

  private parseStructuredOutput(text: string): CandidateSummaryResult {
    // Extract JSON from potential markdown code blocks
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/```\s*([\s\S]*?)\s*```/) ||
      [null, text];

    const jsonText = jsonMatch[1] || text;

    try {
      // Find JSON object in text
      const startIdx = jsonText.indexOf('{');
      const endIdx = jsonText.lastIndexOf('}');

      if (startIdx === -1 || endIdx === -1) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonText.substring(startIdx, endIdx + 1));

      // Validate required fields
      if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 10) {
        throw new Error('Invalid or missing score');
      }

      if (!Array.isArray(parsed.strengths)) {
        throw new Error('Invalid or missing strengths array');
      }

      if (!Array.isArray(parsed.concerns)) {
        parsed.concerns = [];
      }

      if (!parsed.summary || typeof parsed.summary !== 'string') {
        throw new Error('Invalid or missing summary');
      }

      const validDecisions: RecommendedDecision[] = ['advance', 'hold', 'reject'];
      if (!validDecisions.includes(parsed.recommendedDecision)) {
        throw new Error('Invalid recommendedDecision');
      }

      return {
        score: parsed.score,
        strengths: parsed.strengths,
        concerns: parsed.concerns,
        summary: parsed.summary,
        recommendedDecision: parsed.recommendedDecision,
      };
    } catch (error) {
      this.logger.error(`Failed to parse LLM output: ${error}`);
      this.logger.debug(`Raw output: ${text}`);
      throw new Error(`Invalid structured output from LLM: ${error}`);
    }
  }
}