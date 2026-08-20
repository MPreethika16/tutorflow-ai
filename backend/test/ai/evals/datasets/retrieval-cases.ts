import { RetrievalEvalCase } from './contracts';

export const RETRIEVAL_EVAL_CASES: RetrievalEvalCase[] = [
  {
    id: 'ret-1',
    query: 'How do plants eat?',
    expectedPromptFragment: 'photosynthesis',
    shouldReject: false,
  },
  {
    id: 'ret-2',
    query: 'What is F=ma?',
    expectedPromptFragment: 'Newton',
    shouldReject: false,
  },
  {
    id: 'ret-3',
    query: 'What is New Delhi the capital of?',
    expectedPromptFragment: 'capital of India',
    shouldReject: false,
  },
  {
    id: 'ret-4',
    query: 'Who discovered gravity?',
    expectedPromptFragment: 'Newton',
    shouldReject: false,
  },
  {
    id: 'ret-5',
    query: 'Describe the process of converting light to chemical energy.',
    expectedPromptFragment: 'photosynthesis',
    shouldReject: false,
  },
  {
    id: 'ret-6',
    query: 'Name a major city in South Asia.',
    expectedPromptFragment: 'capital of India',
    shouldReject: false,
  },
  {
    id: 'ret-7',
    query: 'Solve the quadratic equation x^2 = 4',
    expectedPromptFragment: null,
    shouldReject: true,
  },
  {
    id: 'ret-8',
    query: 'What happens in the movie Star Wars?',
    expectedPromptFragment: null,
    shouldReject: true,
  },
  {
    id: 'ret-9',
    query: 'How do I bake a chocolate cake?',
    expectedPromptFragment: null,
    shouldReject: true,
  },
];
