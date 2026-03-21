import type {
  InterviewConfig,
  InterviewLevel,
  InterviewQuestion,
  InterviewTopic,
} from '@mianshitong/shared';

const LEVEL_WEIGHT: Record<InterviewLevel, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
};

const TOPIC_ORDER: InterviewTopic[] = [
  'javascript',
  'react',
  'vue',
  'engineering',
  'performance',
  'network',
  'security',
  'node',
];

const DEFAULT_QUESTION_BANK: InterviewQuestion[] = [];

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function buildTagSet(question: InterviewQuestion): Set<string> {
  return new Set((question.tags ?? []).map(normalizeTag));
}

function resolveQuestionTopic(
  question: InterviewQuestion,
  topics: InterviewTopic[],
): InterviewTopic | null {
  const tagSet = buildTagSet(question);
  for (const topic of topics) {
    if (tagSet.has(topic)) {
      return topic;
    }
  }
  return null;
}

function resolveTopicIndex(question: InterviewQuestion, topics: InterviewTopic[]): number {
  const topic = resolveQuestionTopic(question, topics);
  return topic ? topics.indexOf(topic) : topics.length;
}

function sortCandidates(
  topics: InterviewTopic[],
  config: InterviewConfig,
  questionBank: InterviewQuestion[],
): InterviewQuestion[] {
  const candidates = questionBank.filter((item) => resolveQuestionTopic(item, topics) !== null);

  return [...candidates].sort((left, right) => {
    const topicDiff = resolveTopicIndex(left, topics) - resolveTopicIndex(right, topics);
    if (topicDiff !== 0) {
      return topicDiff;
    }

    const levelDiff =
      Math.abs(LEVEL_WEIGHT[left.level] - LEVEL_WEIGHT[config.level]) -
      Math.abs(LEVEL_WEIGHT[right.level] - LEVEL_WEIGHT[config.level]);

    if (levelDiff !== 0) {
      return levelDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function buildTopicBuckets(
  topics: InterviewTopic[],
  sortedCandidates: InterviewQuestion[],
): Map<InterviewTopic, InterviewQuestion[]> {
  const buckets = new Map<InterviewTopic, InterviewQuestion[]>();

  for (const topic of topics) {
    const topicQuestions = sortedCandidates.filter(
      (item) => resolveQuestionTopic(item, topics) === topic,
    );
    if (topicQuestions.length > 0) {
      buckets.set(topic, [...topicQuestions]);
    }
  }

  return buckets;
}

function pickRoundRobin(
  topics: InterviewTopic[],
  buckets: Map<InterviewTopic, InterviewQuestion[]>,
  targetCount: number,
): InterviewQuestion[] {
  const selected: InterviewQuestion[] = [];
  const selectedIds = new Set<string>();

  while (selected.length < targetCount && buckets.size > 0) {
    for (const topic of topics) {
      const queue = buckets.get(topic);
      if (!queue || queue.length === 0) {
        buckets.delete(topic);
        continue;
      }

      const next = queue.shift();
      if (!next || selectedIds.has(next.id)) {
        continue;
      }

      selected.push(next);
      selectedIds.add(next.id);

      if (selected.length >= targetCount) {
        return selected;
      }
    }
  }

  return selected;
}

export function buildQuestionPlan(
  config: InterviewConfig,
  questionBank: InterviewQuestion[] = DEFAULT_QUESTION_BANK,
): InterviewQuestion[] {
  const topics = config.topics.length > 0 ? config.topics : TOPIC_ORDER;
  const sortedCandidates = sortCandidates(topics, config, questionBank);

  if (sortedCandidates.length === 0) {
    return questionBank.slice(0, config.questionCount).map((item) => ({
      ...item,
      topic: resolveQuestionTopic(item, topics),
    }));
  }

  const selected = pickRoundRobin(
    topics,
    buildTopicBuckets(topics, sortedCandidates),
    config.questionCount,
  );

  if (selected.length < config.questionCount) {
    const selectedIds = new Set(selected.map((item) => item.id));
    for (const item of sortedCandidates) {
      if (selectedIds.has(item.id)) {
        continue;
      }

      selected.push(item);
      selectedIds.add(item.id);

      if (selected.length >= config.questionCount) {
        break;
      }
    }
  }

  return selected.slice(0, config.questionCount).map((item) => ({
    ...item,
    topic: resolveQuestionTopic(item, topics),
  }));
}

export function getQuestionById(
  questionId: string,
  questionBank: InterviewQuestion[] = DEFAULT_QUESTION_BANK,
): InterviewQuestion | undefined {
  return questionBank.find((item) => item.id === questionId);
}
