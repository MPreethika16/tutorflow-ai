import type {
  PaperValidationError,
} from './paper-validation.types';

export class PaperValidationFailedError
  extends Error {
  constructor(
    public readonly validationErrors:
      PaperValidationError[],
  ) {
    super(
      'Generated paper remained invalid after repair attempts.',
    );

    this.name =
      'PaperValidationFailedError';
  }
}