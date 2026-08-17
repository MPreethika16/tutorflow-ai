import type {
  GeneratedPaper,
} from '../contracts/generated-paper.schema';

import type {
  GeneratePaperDto,
} from '../dto/generate-paper.dto';

import type {
  PaperValidationError,
} from '../validation/paper-validation.types';

export type GenerationStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'VALIDATING'
  | 'REPAIRING'
  | 'READY'
  | 'PERSISTING'
  | 'COMPLETED'
  | 'FAILED';

export type GenerationState = {
  request: GeneratePaperDto;

  teacherUserId: string;

  teacherContext: string;

  generatedPaper?: GeneratedPaper;

  validationErrors:
    PaperValidationError[];

  repairCount: number;

  status: GenerationStatus;

  persistedAssessment?: {
    assessmentId: string;
    source: string;
    status: string;
  };
};