'use client';

import Link from 'next/link';
import { Button, Card, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { formatDateTime } from '@/lib/format';
import type { KnowledgeTraceOverviewItem, KnowledgeTraceRow } from '@/lib/knowledge-trace';

interface KnowledgeTraceTableCardProps {
  rows: KnowledgeTraceRow[];
  modeDistribution: KnowledgeTraceOverviewItem[];
  intentDistribution: KnowledgeTraceOverviewItem[];
}

function formatIntentKind(value: KnowledgeTraceRow['intentKind']): string {
  if (value === 'technical_question') {
    return '技术问答';
  }

  if (value === 'interview_playbook') {
    return '面试打法';
  }

  if (value === 'project_highlight') {
    return '项目亮点';
  }

  if (value === 'resume_optimize') {
    return '简历优化';
  }

  return '自我介绍';
}

function formatMode(value: KnowledgeTraceRow['mode']): {
  label: string;
  color: 'green' | 'gold' | 'default';
} {
  if (value === 'strong') {
    return { label: '强命中', color: 'green' };
  }

  if (value === 'weak') {
    return { label: '弱命中', color: 'gold' };
  }

  return { label: '未命中', color: 'default' };
}

export function KnowledgeTraceTableCard({
  rows,
  modeDistribution,
  intentDistribution,
}: KnowledgeTraceTableCardProps) {
  const columns: TableColumnsType<KnowledgeTraceRow> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '意图 / 模式',
      key: 'intentMode',
      width: 160,
      render: (_, record) => {
        const mode = formatMode(record.mode);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Tag color="blue">{formatIntentKind(record.intentKind)}</Tag>
            <Tag color={mode.color}>{mode.label}</Tag>
          </div>
        );
      },
    },
    {
      title: 'Query 摘要',
      dataIndex: 'queryPreview',
      key: 'queryPreview',
      render: (value: string) => (
        <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{value || '-'}</Typography.Text>
      ),
    },
    {
      title: 'Top1 文档',
      key: 'topDocumentTitle',
      width: 220,
      render: (_, record) =>
        record.topDocumentTitle ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography.Text strong>{record.topDocumentTitle}</Typography.Text>
            <Typography.Text type="secondary">{record.resultCount} 条结果</Typography.Text>
          </div>
        ) : (
          <Typography.Text type="secondary">未命中</Typography.Text>
        ),
    },
    {
      title: '会话',
      key: 'session',
      width: 220,
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Typography.Text>{record.sessionTitle || '未命名'}</Typography.Text>
          <Typography.Text type="secondary">{record.actorLabel}</Typography.Text>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Link href={`/sessions/${encodeURIComponent(record.sessionId)}`}>
          <Button type="link" style={{ paddingInline: 0 }}>
            查看会话
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <Card
      title="知识检索记录"
      extra={
        <Space size={[8, 8]} wrap>
          {modeDistribution.map((item) => (
            <Tag key={item.key}>{`${item.label} ${item.count}`}</Tag>
          ))}
          {intentDistribution.map((item) => (
            <Tag key={item.key} color="blue">{`${item.label} ${item.count}`}</Tag>
          ))}
        </Space>
      }
    >
      <Table
        rowKey={(record) => record.id}
        dataSource={rows}
        columns={columns}
        pagination={false}
        locale={{ emptyText: '当前筛选条件下暂无知识检索 Trace。' }}
      />
    </Card>
  );
}
