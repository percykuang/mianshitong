'use client';

import type { InterviewLevel } from '@mianshitong/shared';
import { Card, Tag, Typography } from 'antd';

const LEVEL_LABELS: Record<InterviewLevel, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级',
};

export function formatInterviewLevel(level: InterviewLevel | null | undefined): string {
  if (!level) {
    return '不限';
  }

  return LEVEL_LABELS[level] ?? level;
}

export function renderTraceTagList(values: string[], color = 'default') {
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

export function renderTraceNamedTagList(
  items: Array<{ key: string; label: string }>,
  color = 'default',
) {
  if (items.length === 0) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => (
        <Tag key={item.key} color={color}>
          {item.label}
        </Tag>
      ))}
    </div>
  );
}

interface TraceEmptyCardProps {
  title: string;
  description: string;
}

export function TraceEmptyCard({ title, description }: TraceEmptyCardProps) {
  return (
    <Card title={title}>
      <Typography.Text type="secondary">{description}</Typography.Text>
    </Card>
  );
}
