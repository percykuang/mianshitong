import type { EmbeddingProvider } from '@mianshitong/llm';
import type {
  QuestionRetrievalDoc,
  QuestionRetrievalQuery,
  QuestionRetrievalResult,
} from './question-retrieval';
import {
  buildQuerySearchText,
  searchQuestionDocs,
  type QuestionRetriever,
} from './question-retrieval';

export interface QuestionVectorSearchMatch {
  doc: QuestionRetrievalDoc;
  similarity: number;
}

export interface QuestionVectorStore {
  searchByEmbedding(input: {
    embedding: number[];
    query: QuestionRetrievalQuery;
    limit: number;
  }): Promise<QuestionVectorSearchMatch[]>;
}

export interface CreateVectorQuestionRetrieverInput {
  embeddingProvider: EmbeddingProvider;
  vectorStore: QuestionVectorStore;
  fallbackRetriever?: QuestionRetriever;
  semanticWeight?: number;
  minSimilarity?: number;
  candidateLimit?: number;
}

function clampSimilarity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export function createVectorQuestionRetriever(
  input: CreateVectorQuestionRetrieverInput,
): QuestionRetriever {
  return {
    async search(query): Promise<QuestionRetrievalResult[]> {
      const queryText = buildQuerySearchText(query).trim();
      if (!queryText) {
        return input.fallbackRetriever ? input.fallbackRetriever.search(query) : [];
      }

      const [embedding] = await input.embeddingProvider.embedTexts({
        texts: [queryText],
      });

      if (!embedding || embedding.length === 0) {
        return input.fallbackRetriever ? input.fallbackRetriever.search(query) : [];
      }

      const vectorMatches = await input.vectorStore.searchByEmbedding({
        embedding,
        query,
        limit: input.candidateLimit ?? Math.max(query.limit ?? 20, 12),
      });

      const filteredMatches = vectorMatches.filter(
        (match) => clampSimilarity(match.similarity) >= (input.minSimilarity ?? 0.15),
      );

      if (filteredMatches.length === 0) {
        return input.fallbackRetriever ? input.fallbackRetriever.search(query) : [];
      }

      const semanticWeight = input.semanticWeight ?? 4.8;
      const semanticScoresByQuestionId = new Map(
        filteredMatches.map((match) => [
          match.doc.id,
          clampSimilarity(match.similarity) * semanticWeight,
        ]),
      );

      return searchQuestionDocs({
        docs: filteredMatches.map((match) => match.doc),
        query,
        semanticScoresByQuestionId,
      });
    },
  };
}
