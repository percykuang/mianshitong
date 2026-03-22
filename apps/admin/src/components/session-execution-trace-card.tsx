'use client';

import type {
  ChatSession,
  InterviewAssessmentTrace,
  InterviewFollowUpDecision,
  InterviewFollowUpTrace,
  InterviewLevel,
  InterviewQuestion,
} from '@mianshitong/shared';
import { Card, Collapse, Descriptions, List, Tag, Typography } from 'antd';
import type { CollapseProps, DescriptionsProps } from 'antd';

interface SessionExecutionTraceCardProps {
  runtime: ChatSession['runtime'];
}

interface ExecutionTraceGroup {
  question: InterviewQuestion;
  questionIndex: number;
  followUps: InterviewFollowUpTrace[];
  assessment: InterviewAssessmentTrace | null;
}

const LEVEL_LABELS: Record<InterviewLevel, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级',
};

const FOLLOW_UP_DECISION_MAP: Record<InterviewFollowUpDecision, { label: string; color: string }> =
  {
    ask_follow_up: { label: '触发追问', color: 'blue' },
    skip_no_key_points: { label: '题目无要点', color: 'default' },
    skip_max_round: { label: '达到追问上限', color: 'gold' },
    skip_coverage_sufficient: { label: '覆盖已足够', color: 'green' },
    skip_all_points_covered: { label: '要点已覆盖', color: 'green' },
  };

function formatLevel(level: InterviewLevel): string {
  return LEVEL_LABELS[level] ?? level;
}

function renderTagList(values: string[], color = 'default') {
  if (values.length === 0) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {values.map((value, index) => (
        <Tag key={`${value}-${index}`} color={color}>
          {value}
        </Tag>
      ))}
    </div>
  );
}

function groupExecutionTrace(runtime: ChatSession['runtime']): ExecutionTraceGroup[] {
  return runtime.questionPlan.map((question, index) => ({
    question,
    questionIndex: index + 1,
    followUps: runtime.followUpTrace.filter((item) => item.questionId === question.id),
    assessment: runtime.assessmentTrace.find((item) => item.questionId === question.id) ?? null,
  }));
}

function buildAssessmentItems(
  assessment: InterviewAssessmentTrace | null,
): DescriptionsProps['items'] {
  if (!assessment) {
    return [
      {
        key: 'empty',
        label: '评分结果',
        children: <Typography.Text type="secondary">当前还没有评分结果。</Typography.Text>,
      },
    ];
  }

  return [
    {
      key: 'average',
      label: '平均分',
      children: <Typography.Text strong>{assessment.averageScore}</Typography.Text>,
    },
    {
      key: 'answerLength',
      label: '回答长度',
      children: `${assessment.answerLength} 字符`,
    },
    {
      key: 'keyPointCount',
      label: '要点数',
      children: assessment.keyPointCount,
    },
    {
      key: 'createdAt',
      label: '评分时间',
      children: assessment.createdAt,
    },
    {
      key: 'summary',
      label: '评分总结',
      span: 2,
      children: assessment.summary,
    },
    {
      key: 'answerPreview',
      label: '回答摘要',
      span: 2,
      children: assessment.answerPreview || '-',
    },
    {
      key: 'matchedPoints',
      label: '命中要点',
      span: 2,
      children: renderTagList(assessment.matchedPoints, 'green'),
    },
    {
      key: 'missingPoints',
      label: '缺失要点',
      span: 2,
      children: renderTagList(assessment.missingPoints, 'red'),
    },
  ];
}

function buildScoreItems(assessment: InterviewAssessmentTrace | null): DescriptionsProps['items'] {
  if (!assessment) {
    return [];
  }

  return [
    {
      key: 'correctness',
      label: '正确性',
      children: assessment.scores.correctness,
    },
    {
      key: 'depth',
      label: '深度',
      children: assessment.scores.depth,
    },
    {
      key: 'communication',
      label: '表达',
      children: assessment.scores.communication,
    },
    {
      key: 'engineering',
      label: '工程化',
      children: assessment.scores.engineering,
    },
    {
      key: 'tradeoffs',
      label: '权衡',
      children: assessment.scores.tradeoffs,
    },
  ];
}

export function SessionExecutionTraceCard({ runtime }: SessionExecutionTraceCardProps) {
  const groups = groupExecutionTrace(runtime);

  if (groups.length === 0) {
    return (
      <Card title="面试执行 Trace">
        <Typography.Text type="secondary">该会话还没有进入执行阶段。</Typography.Text>
      </Card>
    );
  }

  const items: CollapseProps['items'] = groups.map((group) => {
    const followUpCount = group.followUps.filter(
      (item) => item.decision === 'ask_follow_up',
    ).length;
    const latestDecision = group.followUps.at(-1);
    const latestDecisionMeta = latestDecision
      ? FOLLOW_UP_DECISION_MAP[latestDecision.decision]
      : null;

    return {
      key: group.question.id,
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            width: '100%',
            paddingRight: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography.Text strong>
              第 {group.questionIndex} 题 · {group.question.title}
            </Typography.Text>
            <Typography.Text type="secondary">{group.question.id}</Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag>{formatLevel(group.question.level)}</Tag>
            <Tag color={followUpCount > 0 ? 'blue' : 'default'}>追问 {followUpCount} 次</Tag>
            {group.assessment ? (
              <Tag color="green">已评分 {group.assessment.averageScore}</Tag>
            ) : null}
            {latestDecisionMeta ? (
              <Tag color={latestDecisionMeta.color}>{latestDecisionMeta.label}</Tag>
            ) : null}
          </div>
        </div>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Descriptions
            column={2}
            size="small"
            colon={false}
            items={[
              {
                key: 'questionId',
                label: '题目 ID',
                children: group.question.id,
              },
              {
                key: 'level',
                label: '难度',
                children: formatLevel(group.question.level),
              },
              {
                key: 'tags',
                label: '标签',
                span: 2,
                children: renderTagList(group.question.tags),
              },
              {
                key: 'prompt',
                label: '题目描述',
                span: 2,
                children: group.question.prompt || '-',
              },
            ]}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Typography.Text strong>追问决策</Typography.Text>
            {group.followUps.length === 0 ? (
              <Typography.Text type="secondary">当前还没有追问决策记录。</Typography.Text>
            ) : (
              <List
                bordered
                dataSource={group.followUps}
                renderItem={(item) => {
                  const meta = FOLLOW_UP_DECISION_MAP[item.decision];

                  return (
                    <List.Item>
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 16,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Tag color={meta.color}>第 {item.round} 轮</Tag>
                            <Tag color={meta.color}>{meta.label}</Tag>
                            <Typography.Text type="secondary">
                              覆盖率 {(item.coverage * 100).toFixed(0)}%
                            </Typography.Text>
                          </div>
                          <Typography.Text type="secondary">{item.createdAt}</Typography.Text>
                        </div>

                        <Descriptions
                          column={2}
                          size="small"
                          colon={false}
                          items={[
                            {
                              key: 'askedMissingPoint',
                              label: '追问焦点',
                              children: item.askedMissingPoint ?? '-',
                            },
                            {
                              key: 'answerLength',
                              label: '回答长度',
                              children: `${item.answerLength} 字符`,
                            },
                            {
                              key: 'answerPreview',
                              label: '回答摘要',
                              span: 2,
                              children: item.answerPreview || '-',
                            },
                            {
                              key: 'matchedPoints',
                              label: '命中要点',
                              span: 2,
                              children: renderTagList(item.matchedPoints, 'green'),
                            },
                            {
                              key: 'missingPoints',
                              label: '缺失要点',
                              span: 2,
                              children: renderTagList(item.missingPoints, 'red'),
                            },
                          ]}
                        />
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Typography.Text strong>最终评分</Typography.Text>
            <Descriptions
              column={2}
              size="small"
              colon={false}
              items={buildAssessmentItems(group.assessment)}
            />
            {group.assessment ? (
              <Descriptions
                column={5}
                size="small"
                colon={false}
                items={buildScoreItems(group.assessment)}
              />
            ) : null}
          </div>
        </div>
      ),
    };
  });

  return (
    <Card title="面试执行 Trace">
      <Collapse items={items} />
    </Card>
  );
}
