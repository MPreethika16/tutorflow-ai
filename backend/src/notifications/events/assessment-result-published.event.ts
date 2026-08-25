export class AssessmentResultPublishedEvent {
  constructor(
    public readonly attemptId: string,
    public readonly userId: string,
    public readonly assessmentTitle: string,
  ) {}
}
