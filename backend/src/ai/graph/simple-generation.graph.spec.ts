import {
  buildSimpleGenerationGraph,
} from './simple-generation.graph';

describe('SimpleGenerationGraph', () => {
  it('runs from START through generate to END', async () => {
    const graph =
      buildSimpleGenerationGraph();

    const result =
      await graph.invoke({
        topic:
          'Quadratic Equations',
      });

    expect(
      result.topic,
    ).toBe(
      'Quadratic Equations',
    );

    expect(
      result.generatedText,
    ).toBe(
      'Generated paper about Quadratic Equations',
    );
  });
});