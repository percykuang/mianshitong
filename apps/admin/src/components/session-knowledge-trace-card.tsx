'use client';

import {
  normalizeKnowledgeTracePreferredTags,
  type ChatSession,
  type KnowledgeRetrievalTraceEntry,
} from '@mianshitong/shared';
import { Card, Collapse, Descriptions, List, Tag, Typography } from 'antd';
import type { CollapseProps, DescriptionsProps } from 'antd';
import { renderTraceTagList, TraceEmptyCard } from './session-trace-shared';

interface SessionKnowledgeTraceCardProps {
  runtime: ChatSession['runtime'];
}

function formatIntentKind(intentKind: KnowledgeRetrievalTraceEntry['intentKind']): string {
  if (intentKind === 'technical_question') {
    return '技术问答';
  }

  if (intentKind === 'interview_playbook') {
    return '面试打法';
  }

  if (intentKind === 'project_highlight') {
    return '项目亮点';
  }

  if (intentKind === 'resume_optimize') {
    return '简历优化';
  }

  return '自我介绍';
}

function formatMode(mode: KnowledgeRetrievalTraceEntry['mode']): { label: string; color: string } {
  if (mode === 'strong') {
    return { label: '强命中', color: 'green' };
  }

  if (mode === 'weak') {
    return { label: '弱命中', color: 'gold' };
  }

  return { label: '未命中', color: 'default' };
}

function formatCategory(category: KnowledgeRetrievalTraceEntry['categories'][number]): string {
  if (category === 'tech_knowledge') {
    return '技术知识';
  }

  if (category === 'interview_playbook') {
    return '面试打法';
  }

  return '项目/简历';
}

function buildOverviewItems(entry: KnowledgeRetrievalTraceEntry): DescriptionsProps['items'] {
  const modeMeta = formatMode(entry.mode);

  return [
    {
      key: 'intent',
      label: '意图',
      children: formatIntentKind(entry.intentKind),
    },
    {
      key: 'mode',
      label: '命中模式',
      children: <Tag color={modeMeta.color}>{modeMeta.label}</Tag>,
    },
    {
      key: 'createdAt',
      label: '记录时间',
      span: 2,
      children: entry.createdAt,
    },
    {
      key: 'categories',
      label: '检索分类',
      span: 2,
      children: renderTraceTagList(
        entry.categories.map((item) => formatCategory(item)),
        'blue',
      ),
    },
    {
      key: 'preferredTags',
      label: '偏好标签',
      span: 2,
      children: renderTraceTagList(
        normalizeKnowledgeTracePreferredTags(entry.preferredTags, entry.intentKind),
      ),
    },
    {
      key: 'queryPreview',
      label: 'Query 摘要',
      span: 2,
      children: (
        <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>
          {entry.queryPreview || '-'}
        </Typography.Text>
      ),
    },
  ];
}

export function SessionKnowledgeTraceCard({ runtime }: SessionKnowledgeTraceCardProps) {
  const traces = [...(runtime.knowledgeRetrievalTrace ?? [])].reverse();
  const defaultActiveKey = traces[0] ? [`${traces[0].createdAt}-0`] : undefined;

  if (traces.length === 0) {
    return <TraceEmptyCard title="知识检索 Trace" description="该会话还没有产生知识检索记录。" />;
  }

  const items: CollapseProps['items'] = traces.map((entry, index) => {
    const modeMeta = formatMode(entry.mode);

    return {
      key: `${entry.createdAt}-${index}`,
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
              第 {traces.length - index} 次 · {formatIntentKind(entry.intentKind)}
            </Typography.Text>
            <Typography.Text type="secondary">{entry.createdAt}</Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag color={modeMeta.color}>{modeMeta.label}</Tag>
            <Tag>{entry.results.length} 条结果</Tag>
          </div>
        </div>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Descriptions column={2} size="small" colon={false} items={buildOverviewItems(entry)} />

          <Card
            type="inner"
            title="检索结果"
            styles={{
              body: {
                paddingTop: 12,
                paddingBottom: 12,
              },
            }}
          >
            {entry.results.length === 0 ? (
              <Typography.Text type="secondary">本次检索没有返回可注入的知识片段。</Typography.Text>
            ) : (
              <List
                size="small"
                dataSource={entry.results}
                renderItem={(result) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Typography.Text strong>{result.documentTitle}</Typography.Text>
                          <Tag color="blue">{formatCategory(result.category)}</Tag>
                          <Tag>score {result.score.toFixed(3)}</Tag>
                        </div>
                      }
                      description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Typography.Text type="secondary">{result.documentId}</Typography.Text>
                          <Typography.Text type="secondary">
                            {result.headingPath.length > 0
                              ? result.headingPath.join(' > ')
                              : '未提供标题路径'}
                          </Typography.Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>
      ),
    };
  });

  return (
    <Card title="知识检索 Trace">
      <Collapse items={items} defaultActiveKey={defaultActiveKey} />
    </Card>
  );
}
