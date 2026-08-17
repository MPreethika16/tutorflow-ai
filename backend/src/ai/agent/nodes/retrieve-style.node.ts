import type {
  GenerationState,
} from '../generation-state';

import {
  buildTeacherStyleContext,
} from '../../retrieval/teacher-style-context';

import type {
  TeacherStyleRetriever,
} from '../../retrieval/teacher-style-retriever.service';

export async function retrieveStyleNode(
  state: GenerationState,
  teacherStyleRetriever:
    TeacherStyleRetriever,
): Promise<GenerationState> {
  const examples =
    await teacherStyleRetriever.retrieve({
      teacherUserId:
        state.teacherUserId,

      board:
        state.request.board,

      grade:
        state.request.grade,

      subject:
        state.request.subject,
    });

  const teacherContext =
    buildTeacherStyleContext(
      examples,
    );

  return {
    ...state,
    teacherContext,
  };
}