import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  RecommendedDecision,
  SummarizationProvider,
} from './summarization-provider.interface';


const GEMINI_MODEL = 'gemini-2.5-flash-lite';

interface GeminiResponseSchema {
  score: number;
  strengths: string[];
  concerns: string[];
  summary: string;
  recommendedDecision: RecommendedDecision;
}

@Injectable()
export class GeminiSummarizationProvider implements SummarizationProvider {
  private readonly logger = new Logger(GeminiSummarizationProvider.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
  }

  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const combinedText = input.documents.join('\n\n---\n\n');

    const prompt = `
You are a hiring assistant. Analyse the following candidate documents and return a structured JSON evaluation.

Candidate ID: ${input.candidateId}

--- BEGIN DOCUMENTS ---
${combinedText}
--- END DOCUMENTS ---

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "score": <integer 0-100>,
  "strengths": [<string>, ...],
  "concerns": [<string>, ...],
  "summary": "<2-3 sentence professional summary>",
  "recommendedDecision": "<advance|hold|reject>"
}
`.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini returned an empty response');
    }

    let parsed: GeminiResponseSchema;
    try {
      parsed = JSON.parse(rawText.trim()) as GeminiResponseSchema;
    } catch {
      throw new Error(`Failed to parse Gemini JSON response: ${rawText}`);
    }

    this.validateParsedResult(parsed);
    return parsed;
  }

  private validateParsedResult(parsed: GeminiResponseSchema): void {
    if (
      typeof parsed.score !== 'number' ||
      parsed.score < 0 ||
      parsed.score > 100 ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.concerns) ||
      typeof parsed.summary !== 'string' ||
      !['advance', 'hold', 'reject'].includes(parsed.recommendedDecision)
    ) {
      throw new Error('Gemini response did not match the expected schema');
    }
  }
}
