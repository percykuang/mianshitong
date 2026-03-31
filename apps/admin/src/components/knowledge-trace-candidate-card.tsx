'use client';

import Link from 'next/link';
import { Button, Card, List, Tag, Typography } from 'antd';
import type { KnowledgeTraceRegressionCandidate } from '@/lib/knowledge-trace';

interface KnowledgeTraceCandidateCardProps {
  candidates: KnowledgeTraceRegressionCandidate[];
}

function formatIntentKind(intentKind: KnowledgeTraceRegressionCandidate['intentKind']): string {
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

function formatMode(mode: KnowledgeTraceRegressionCandidate['dominantMode']): {
  label: string;
  color: 'default' | 'gold';
} {
  if (mode === 'none') {
    return { label: '优先处理：未命中', color: 'default' };
  }

  return { label: '优先处理：弱命中', color: 'gold' };
}

export function KnowledgeTraceCandidateCard({ candidates }: KnowledgeTraceCandidateCardProps) {
  return (
    <Card title="高优先级回归候选" style={{ marginBottom: 16 }}>
      {candidates.length === 0 ? (
        <Typography.Text type="secondary">
          当前筛选范围内还没有需要优先回灌到 eval 的 weak / none 样本。
        </Typography.Text>
      ) : (
        <List
          dataSource={candidates}
          renderItem={(candidate) => {
            const modeMeta = formatMode(candidate.dominantMode);

            return (
              <List.Item
                actions={[
                  <Link
                    key="session"
                    href={`/sessions/${encodeURIComponent(candidate.exampleSessionId)}`}
                  >
                    <Button type="link" style={{ paddingInline: 0 }}>
                      查看样本会话
                    </Button>
                  </Link>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <Tag color={modeMeta.color}>{modeMeta.label}</Tag>
                      <Tag color="blue">{formatIntentKind(candidate.intentKind)}</Tag>
                      <Tag>{`${candidate.count} 次`}</Tag>
                      {candidate.topDocumentTitle ? <Tag>{candidate.topDocumentTitle}</Tag> : null}
                    </div>
                  }
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Typography.Text strong style={{ whiteSpace: 'pre-wrap' }}>
                        {candidate.queryPreview}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        示例会话：{candidate.exampleSessionTitle || '未命名'}
                      </Typography.Text>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}
