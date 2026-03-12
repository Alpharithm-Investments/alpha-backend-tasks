import { Module } from "@nestjs/common";

import { FakeSummarizationProvider } from "./fake-summarization.provider";
import { GeminiSummarizationProvider } from "./gemini-summarization.provider";
import { SUMMARIZATION_PROVIDER } from "./summarization-provider.interface";

@Module({
  providers: [
    FakeSummarizationProvider,
    {
      provide: SUMMARIZATION_PROVIDER,
      useFactory: () => {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
          // Use fake provider in development/testing
          return new FakeSummarizationProvider();
        }

        // Use real Gemini provider when API key is available
        return new GeminiSummarizationProvider(apiKey);
      },
    },
  ],
  exports: [
    SUMMARIZATION_PROVIDER,
    FakeSummarizationProvider,
  ],
})
export class LlmModule {}
