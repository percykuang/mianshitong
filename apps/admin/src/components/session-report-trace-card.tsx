'use client';

import type {
  ChatSession,
  InterviewReportPointTrace,
  InterviewScoreDimension,
} from '@mianshitong/shared';
import { Card, Collapse, Descriptions, List, Tag, Typography } from 'antd';
import type { CollapseProps, DescriptionsProps } from 'antd';

interface SessionReportTraceCardProps {
  runtime: ChatSession['runtime'];
}

const DIMENSION_LABELS: Record<InterviewScoreDimension, string> = {
  correctness: '正确性',
  depth: '深度',
  communication: '表达',
  engineering: '工程化',
  tradeoffs: '权衡',
};

const REPORT_LEVEL_META = {
  'needs-work': { label: '待加强', color: 'red' },
  solid: { label: '合格', color: 'blue' },
  strong: { label: '优秀', color: 'green' },
} as const;

function renderQuestionSources(points: InterviewReportPointTrace['sources']) {
  if (points.length === 0) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {points.map((item) => (
        <Tag key={`${item.questionId}-${item.questionTitle}`}>{item.questionTitle}</Tag>
      ))}
    </div>
  );
}

function buildPointList(
  title: string,
  emptyText: string,
  points: InterviewReportPointTrace[],
  color: string,
) {
  if (points.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="secondary">{emptyText}</Typography.Text>
      </div>
    );
  }

  return (
    <List
      size="small"
      header={<Typography.Text strong>{title}</Typography.Text>}
      bordered
      dataSource={points}
      renderItem={(item) => (
        <List.Item>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Tag color={color}>{item.point}</Tag>
              <Typography.Text type="secondary">命中 {item.count} 题</Typography.Text>
            </div>
            {renderQuestionSources(item.sources)}
          </div>
        </List.Item>
      )}
    />
  );
}

export function SessionReportTraceCard({ runtime }: SessionReportTraceCardProps) {
  const trace = runtime.reportTrace;

  if (!trace) {
    return (
      <Card title="面试报告 Trace">
        <Typography.Text type="secondary">
          {runtime.assessments.length > 0
            ? '该会话已有评分结果，但还没有结构化报告 Trace，通常说明这是旧会话数据。'
            : '该会话还没有生成面试报告。'}
        </Typography.Text>
      </Card>
    );
  }

  const levelMeta = REPORT_LEVEL_META[trace.level];
  const overviewItems: DescriptionsProps['items'] = [
    {
      key: 'createdAt',
      label: '生成时间',
      children: trace.createdAt,
    },
    {
      key: 'assessmentCount',
      label: '评分题数',
      children: trace.assessmentCount,
    },
    {
      key: 'overallScore',
      label: '总分',
      children: <Typography.Text strong>{trace.overallScore}</Typography.Text>,
    },
    {
      key: 'level',
      label: '等级',
      children: <Tag color={levelMeta.color}>{levelMeta.label}</Tag>,
    },
    {
      key: 'formula',
      label: '聚合规则',
      span: 2,
      children: trace.overallScoreFormula,
    },
    {
      key: 'levelReason',
      label: '等级判定',
      span: 2,
      children: trace.levelReason,
    },
    {
      key: 'summaryTemplate',
      label: '模板分支',
      span: 2,
      children: levelMeta.label,
    },
    {
      key: 'overallSummary',
      label: '最终总结',
      span: 2,
      children: trace.overallSummary,
    },
  ];

  const dimensionItems: DescriptionsProps['items'] = trace.dimensionTraces.map((item, index) => ({
    key: item.dimension,
    label: DIMENSION_LABELS[item.dimension],
    span: index === trace.dimensionTraces.length - 1 ? 2 : 1,
    children: item.averageScore,
  }));

  const dimensionCollapseItems: CollapseProps['items'] = trace.dimensionTraces.map((item) => ({
    key: item.dimension,
    label: `${DIMENSION_LABELS[item.dimension]} · 均分 ${item.averageScore}`,
    children: (
      <List
        size="small"
        bordered
        dataSource={item.sources}
        renderItem={(source) => (
          <List.Item>
            <div
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Typography.Text strong>{source.questionTitle}</Typography.Text>
                <Typography.Text type="secondary">{source.questionId}</Typography.Text>
              </div>
              <Tag>{source.score}</Tag>
            </div>
          </List.Item>
        )}
      />
    ),
  }));

  return (
    <Card title="面试报告 Trace">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Descriptions column={2} size="small" colon={false} items={overviewItems} />

        <Descriptions
          title="维度均分"
          column={2}
          size="small"
          colon={false}
          items={dimensionItems}
        />

        <Collapse items={dimensionCollapseItems} />

        {buildPointList('优势来源', '当前没有提炼出优势项。', trace.strengths, 'green')}
        {buildPointList('短板来源', '当前没有提炼出短板项。', trace.gaps, 'red')}

        {trace.nextSteps.length > 0 ? (
          <List
            size="small"
            header={<Typography.Text strong>改进建议生成</Typography.Text>}
            bordered
            dataSource={trace.nextSteps}
            renderItem={(item) => (
              <List.Item>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  <Typography.Text strong>{item.action}</Typography.Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Typography.Text type="secondary">来源短板</Typography.Text>
                    <Tag color="gold">{item.gap}</Tag>
                  </div>
                  {renderQuestionSources(item.sources)}
                </div>
              </List.Item>
            )}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Typography.Text strong>改进建议生成</Typography.Text>
            <Typography.Text type="secondary">当前没有需要生成的改进建议。</Typography.Text>
          </div>
        )}
      </div>
    </Card>
  );
}
