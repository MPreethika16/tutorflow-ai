import {
  END,
  START,
  StateGraph,
  StateSchema,
} from '@langchain/langgraph';

import { z } from 'zod';

const SimpleGenerationState =
  new StateSchema({
    topic: z.string(),

    generatedText:
      z.string().default(''),
  });

export function buildSimpleGenerationGraph() {
  const generateNode:
    typeof SimpleGenerationState.Node =
    async (state) => {
      return {
        generatedText:
          `Generated paper about ${state.topic}`,
      };
    };

  return new StateGraph(
    SimpleGenerationState,
  )
    .addNode(
      'generate',
      generateNode,
    )
    .addEdge(
      START,
      'generate',
    )
    .addEdge(
      'generate',
      END,
    )
    .compile();
}