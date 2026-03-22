'use client';

import type { ChatSession } from '@mianshitong/shared';
import { Card, Descriptions, List, Tag, Typography } from 'antd';
import { useLayoutEffect, useRef, useState } from 'react';
import { SessionExecutionTraceCard } from '@/components/session-execution-trace-card';
import { SessionPlanningTraceCard } from '@/components/session-planning-trace-card';
import { SessionReportTraceCard } from '@/components/session-report-trace-card';

interface SessionMeta {
  id: string;
  title: string;
  userEmail: string;
  modelId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionMessage {
  id: string;
  role: string;
  kind: string;
  content: string;
  createdAt: string;
}

interface SessionDetailViewProps {
  session: SessionMeta;
  messages: SessionMessage[];
  runtime: ChatSession['runtime'];
}

export function SessionDetailView({ session, messages, runtime }: SessionDetailViewProps) {
  const visibleMessages = messages.filter(
    (item) => item.role !== 'system' && item.kind !== 'system',
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const target = scrollRef.current;
    if (!target) {
      return;
    }

    const container = target.closest('.admin-content-scroll') as HTMLElement | null;
    if (!container) {
      return;
    }

    const updateHeight = () => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const top = targetRect.top - containerRect.top + container.scrollTop;
      const next = Math.max(240, Math.floor(container.clientHeight - top - 48));
      setMaxHeight(next);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      resizeObserver?.disconnect();
    };
  }, [visibleMessages.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="会话概览">
        <Descriptions
          column={2}
          size="small"
          colon={false}
          styles={{ label: { width: 100 } }}
          items={[
            { key: 'id', label: '会话 ID', children: session.id },
            { key: 'userEmail', label: '用户', children: session.userEmail },
            { key: 'title', label: '标题', children: session.title || '未命名' },
            { key: 'modelId', label: '模型', children: session.modelId },
            { key: 'status', label: '状态', children: session.status },
            { key: 'createdAt', label: '创建时间', children: session.createdAt },
            { key: 'updatedAt', label: '更新时间', children: session.updatedAt },
            { key: 'messageCount', label: '消息数', children: visibleMessages.length },
          ]}
        />
      </Card>

      <SessionPlanningTraceCard runtime={runtime} />
      <SessionExecutionTraceCard runtime={runtime} />
      <SessionReportTraceCard runtime={runtime} />

      <Card title="对话记录" styles={{ body: { padding: 0 } }}>
        {visibleMessages.length === 0 ? (
          <div style={{ padding: 24 }}>
            <Typography.Text type="secondary">暂无消息。</Typography.Text>
          </div>
        ) : (
          <div ref={scrollRef} style={{ maxHeight: maxHeight ?? 420, overflowY: 'auto' }}>
            <div style={{ padding: 24 }}>
              <List
                dataSource={visibleMessages}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          <Tag color={item.role === 'user' ? 'blue' : 'green'}>
                            {item.role === 'user' ? '用户' : 'AI'}
                          </Tag>
                          <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                            {item.createdAt}
                          </Typography.Text>
                        </span>
                      }
                      description={
                        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                          {item.content}
                        </Typography.Paragraph>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
