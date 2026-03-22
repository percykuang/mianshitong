'use client';

import type {
  ChatSession,
  InterviewLevel,
  InterviewPlanningCandidateTrace,
  InterviewPlanningStepTrace,
} from '@mianshitong/shared';
import { Card, Collapse, Descriptions, List, Table, Tag, Typography } from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';

interface SessionPlanningTraceCardProps {
  runtime: ChatSession['runtime'];
}

interface CandidateRow extends InterviewPlanningCandidateTrace {
  key: string;
  rank: number;
  isSelected: boolean;
}

const LEVEL_LABELS: Record<InterviewLevel, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级',
};

function formatLevel(level: InterviewLevel | null | undefined): string {
  if (!level) {
    return '不限';
  }

  return LEVEL_LABELS[level] ?? level;
}

function formatStrategy(strategy: string | null | undefined): string {
  if (strategy === 'hybrid-vector-v1') {
    return 'Hybrid Vector';
  }

  if (strategy === 'hybrid-lexical-v1') {
    return 'Hybrid Lexical';
  }

  return strategy ?? '-';
}

function formatRetrievalMode(mode: InterviewPlanningStepTrace['retrievalMode']): string {
  return mode === 'target_level' ? '目标难度召回' : '全量补位召回';
}

function renderTagList(tags: string[], color = 'default') {
  if (tags.length === 0) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {tags.map((tag, index) => (
        <Tag key={`${tag}-${index}`} color={color}>
          {tag}
        </Tag>
      ))}
    </div>
  );
}

function buildBreakdownText(candidate: InterviewPlanningCandidateTrace) {
  const { breakdown } = candidate;
  return [
    `semantic ${breakdown.semantic}`,
    `lexical ${breakdown.lexical}`,
    `tag ${breakdown.tag}`,
    `must ${breakdown.mustInclude}`,
    `optional ${breakdown.optional}`,
    `level ${breakdown.level}`,
    `penalty ${breakdown.penalty}`,
  ].join(' / ');
}

function buildCandidateColumns(): TableColumnsType<CandidateRow> {
  return [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 72,
      render: (_value, record) =>
        record.isSelected ? <Tag color="blue">命中 #{record.rank}</Tag> : `#${record.rank}`,
    },
    {
      title: '题目',
      dataIndex: 'questionTitle',
      key: 'questionTitle',
      render: (_value, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Typography.Text strong>{record.questionTitle}</Typography.Text>
          <Typography.Text type="secondary">{record.questionId}</Typography.Text>
        </div>
      ),
    },
    {
      title: '难度',
      dataIndex: 'level',
      key: 'level',
      width: 92,
      render: (value: InterviewLevel) => <Tag>{formatLevel(value)}</Tag>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => renderTagList(tags),
    },
    {
      title: '命中',
      key: 'matched',
      render: (_value, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <Typography.Text type="secondary" style={{ marginRight: 8 }}>
              命中标签
            </Typography.Text>
            {renderTagList(record.matchedTags)}
          </div>
          <div>
            <Typography.Text type="secondary" style={{ marginRight: 8 }}>
              必考标签
            </Typography.Text>
            {renderTagList(record.matchedMustIncludeTags, 'blue')}
          </div>
        </div>
      ),
    },
    {
      title: '总分',
      dataIndex: 'score',
      key: 'score',
      width: 88,
      render: (value: number) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: '分数拆解',
      key: 'breakdown',
      width: 320,
      render: (_value, record) => (
        <Typography.Text type="secondary" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {buildBreakdownText(record)}
        </Typography.Text>
      ),
    },
  ];
}

export function SessionPlanningTraceCard({ runtime }: SessionPlanningTraceCardProps) {
  const trace = runtime.planningTrace;
  const questionPlan = Array.isArray(runtime.questionPlan) ? runtime.questionPlan : [];
  const overviewItems: DescriptionsProps['items'] = [
    {
      key: 'strategy',
      label: '检索策略',
      children: (
        <Tag color={trace?.strategy === 'hybrid-vector-v1' ? 'blue' : 'default'}>
          {formatStrategy(trace?.strategy)}
        </Tag>
      ),
    },
    {
      key: 'generatedAt',
      label: '生成时间',
      children: runtime.planGeneratedAt ?? '-',
    },
    {
      key: 'questionCount',
      label: '题目数量',
      children: runtime.interviewBlueprint?.questionCount ?? questionPlan.length,
    },
    {
      key: 'progress',
      label: '当前进度',
      children:
        questionPlan.length > 0
          ? `${Math.min(runtime.currentQuestionIndex + 1, questionPlan.length)}/${questionPlan.length}`
          : '-',
    },
    {
      key: 'mustIncludeTags',
      label: '必考标签',
      span: 2,
      children: renderTagList(runtime.interviewBlueprint?.mustIncludeTags ?? [], 'blue'),
    },
    {
      key: 'optionalTags',
      label: '可选标签',
      span: 2,
      children: renderTagList(runtime.interviewBlueprint?.optionalTags ?? []),
    },
    {
      key: 'levelQuota',
      label: '难度配额',
      span: 2,
      children: trace
        ? `初级 ${trace.levelQuota.junior} / 中级 ${trace.levelQuota.mid} / 高级 ${trace.levelQuota.senior}`
        : '-',
    },
    {
      key: 'sourceTextPreview',
      label: '输入摘要',
      span: 2,
      children: trace?.sourceTextPreview ?? '-',
    },
    {
      key: 'planningSummary',
      label: '规划摘要',
      span: 2,
      children: runtime.planningSummary ?? '-',
    },
  ];

  const profileItems: DescriptionsProps['items'] = runtime.resumeProfile
    ? [
        {
          key: 'seniority',
          label: '画像级别',
          children: formatLevel(runtime.resumeProfile.seniority),
        },
        {
          key: 'experience',
          label: '经验年限',
          children:
            typeof runtime.resumeProfile.yearsOfExperience === 'number'
              ? `${runtime.resumeProfile.yearsOfExperience} 年`
              : '未识别',
        },
        {
          key: 'confidence',
          label: '置信度',
          span: 2,
          children: `${Math.round(runtime.resumeProfile.confidence * 100)}%`,
        },
        {
          key: 'projectTags',
          label: '项目标签',
          span: 2,
          children: renderTagList(runtime.resumeProfile.projectTags),
        },
        {
          key: 'riskFlags',
          label: '风险提示',
          span: 2,
          children: renderTagList(runtime.resumeProfile.riskFlags, 'gold'),
        },
        {
          key: 'evidence',
          label: '识别证据',
          span: 2,
          children:
            runtime.resumeProfile.evidence.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {runtime.resumeProfile.evidence.map((item) => (
                  <Typography.Text key={item}>{item}</Typography.Text>
                ))}
              </div>
            ) : (
              '-'
            ),
        },
      ]
    : [];

  const candidateColumns = buildCandidateColumns();

  if (!trace && !runtime.resumeProfile && !runtime.interviewBlueprint) {
    return (
      <Card title="面试规划 Trace">
        <Typography.Text type="secondary">该会话还没有题单规划信息。</Typography.Text>
      </Card>
    );
  }

  return (
    <Card title="面试规划 Trace">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Descriptions column={2} size="small" colon={false} items={overviewItems} />

        {profileItems.length > 0 ? (
          <Descriptions
            title="候选人画像"
            column={2}
            size="small"
            colon={false}
            items={profileItems}
          />
        ) : null}

        {runtime.interviewBlueprint?.strategyNotes?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Typography.Text strong>出题说明</Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {runtime.interviewBlueprint.strategyNotes.map((item) => (
                <Typography.Text key={item} type="secondary">
                  {item}
                </Typography.Text>
              ))}
            </div>
          </div>
        ) : null}

        {questionPlan.length > 0 ? (
          <List
            size="small"
            header={<Typography.Text strong>最终题单</Typography.Text>}
            bordered
            dataSource={questionPlan}
            renderItem={(item, index) => (
              <List.Item>
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Typography.Text strong>
                      {index + 1}. {item.title}
                    </Typography.Text>
                    <Typography.Text type="secondary">{item.id}</Typography.Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <Tag>{formatLevel(item.level)}</Tag>
                    {item.tags.map((tag) => (
                      <Tag key={`${item.id}-${tag}`}>{tag}</Tag>
                    ))}
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : null}

        {trace?.steps?.length ? (
          <Collapse
            items={trace.steps.map((step) => {
              const rows: CandidateRow[] = step.candidates.map((candidate, index) => ({
                ...candidate,
                key: `${step.slot}-${candidate.questionId}`,
                rank: index + 1,
                isSelected: candidate.questionId === step.selectedQuestionId,
              }));

              return {
                key: String(step.slot),
                label: `第 ${step.slot} 题 · ${formatLevel(step.targetLevel)} · ${step.selectedQuestionTitle ?? '未命中题目'}`,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Descriptions
                      column={2}
                      size="small"
                      colon={false}
                      items={[
                        {
                          key: 'retrievalMode',
                          label: '召回模式',
                          children: formatRetrievalMode(step.retrievalMode),
                        },
                        {
                          key: 'candidateCount',
                          label: '候选数',
                          children: step.candidateCount,
                        },
                        {
                          key: 'selectedScore',
                          label: '最终得分',
                          children: step.selectedScore ?? '-',
                        },
                        {
                          key: 'selectedQuestionId',
                          label: '命中题目 ID',
                          children: step.selectedQuestionId ?? '-',
                        },
                        {
                          key: 'uncoveredMustTags',
                          label: '未覆盖必考标签',
                          span: 2,
                          children: renderTagList(step.uncoveredMustTags, 'gold'),
                        },
                        {
                          key: 'preferredTags',
                          label: '偏好标签权重',
                          span: 2,
                          children:
                            step.preferredTags.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {step.preferredTags.map((item) => (
                                  <Tag key={`${step.slot}-${item.tag}`}>
                                    {item.tag} · {item.weight.toFixed(2)}
                                  </Tag>
                                ))}
                              </div>
                            ) : (
                              '-'
                            ),
                        },
                      ]}
                    />

                    <Table<CandidateRow>
                      size="small"
                      pagination={false}
                      rowKey="key"
                      columns={candidateColumns}
                      dataSource={rows}
                      scroll={{ x: 1280 }}
                    />
                  </div>
                ),
              };
            })}
          />
        ) : null}
      </div>
    </Card>
  );
}
