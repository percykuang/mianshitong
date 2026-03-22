import { buildAssessmentSkillResult, buildReportSkillResult } from '@mianshitong/agent-skills';
import {
  type InterviewAssessmentTrace,
  type InterviewReport,
  type InterviewReportTrace,
  type InterviewRuntimeState,
  type QuestionAssessment,
} from '@mianshitong/shared';

export function buildAssessmentResult(
  question: InterviewRuntimeState['questionPlan'][number],
  answer: string,
  createdAt: string,
): {
  assessment: QuestionAssessment;
  trace: InterviewAssessmentTrace;
} {
  return buildAssessmentSkillResult({
    question,
    answer,
    createdAt,
  });
}

export function buildAssessment(
  question: InterviewRuntimeState['questionPlan'][number],
  answer: string,
): QuestionAssessment {
  return buildAssessmentResult(question, answer, new Date().toISOString()).assessment;
}

export function buildInterviewReportResult(
  assessments: QuestionAssessment[],
  createdAt: string,
): {
  report: InterviewReport;
  trace: InterviewReportTrace;
} {
  return buildReportSkillResult({ assessments, createdAt });
}

export function buildInterviewReport(assessments: QuestionAssessment[]): InterviewReport {
  return buildInterviewReportResult(assessments, new Date().toISOString()).report;
}
