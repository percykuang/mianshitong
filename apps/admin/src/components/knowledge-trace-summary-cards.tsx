'use client';

import { Card, Col, Row, Statistic, Tag, Typography } from 'antd';
import type { KnowledgeTraceOverview } from '@/lib/knowledge-trace';

interface KnowledgeTraceSummaryCardsProps {
  overview: KnowledgeTraceOverview;
  analyzedTraceCount: number;
  truncated: boolean;
}

function renderTopList(
  title: string,
  items: KnowledgeTraceOverview['topQueries'],
  emptyText: string,
) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <Typography.Text type="secondary">{emptyText}</Typography.Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{item.label}</Typography.Text>
              <Tag>{item.count}</Tag>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function KnowledgeTraceSummaryCards({
  overview,
  analyzedTraceCount,
  truncated,
}: KnowledgeTraceSummaryCardsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      <Card>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
        >
          <Typography.Text type="secondary">
            当前统计基于最近筛选窗口内已加载的 {analyzedTraceCount} 条检索记录。
            {truncated ? ' 为控制开销，本页只分析最近 1000 条命中窗口内的检索记录。' : ''}
          </Typography.Text>
        </div>
        <Row gutter={[16, 16]} style={{ marginTop: 4 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="Trace 总数" value={overview.totalTraces} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="有 Trace 的会话数" value={overview.tracedSessionCount} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="强命中" value={overview.strongCount} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="弱命中" value={overview.weakCount} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="未命中" value={overview.noneCount} />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          {renderTopList('高频 Query', overview.topQueries, '当前筛选范围内暂无 Query 记录。')}
        </Col>
        <Col xs={24} lg={12}>
          {renderTopList('高频命中文档', overview.topDocuments, '当前筛选范围内暂无文档命中。')}
        </Col>
      </Row>
    </div>
  );
}
