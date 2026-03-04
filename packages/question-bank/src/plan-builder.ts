import type { InterviewConfig, InterviewQuestion, InterviewTopic } from '@mianshitong/shared';
import { LEVEL_WEIGHT, QUESTION_BANK, TOPIC_ORDER } from './question-data';

function sortCandidates(topics: InterviewTopic[], config: InterviewConfig): InterviewQuestion[] {
  const candidates = QUESTION_BANK.filter((item) => topics.includes(item.topic));

  return [...candidates].sort((left, right) => {
    const topicDiff = topics.indexOf(left.topic) - topics.indexOf(right.topic);
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
    const topicQuestions = sortedCandidates.filter((item) => item.topic === topic);
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

export function buildQuestionPlan(config: InterviewConfig): InterviewQuestion[] {
  const topics = config.topics.length > 0 ? config.topics : TOPIC_ORDER;
  const sortedCandidates = sortCandidates(topics, config);

  if (sortedCandidates.length === 0) {
    return QUESTION_BANK.slice(0, config.questionCount);
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

  return selected.slice(0, config.questionCount);
}

export function getQuestionById(questionId: string): InterviewQuestion | undefined {
  return QUESTION_BANK.find((item) => item.id === questionId);
}
