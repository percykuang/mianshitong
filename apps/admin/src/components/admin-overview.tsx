'use client';

import { Card, Col, List, Row, Statistic, Typography } from 'antd';

interface OverviewCard {
  label: string;
  value: string;
}

interface AdminOverviewProps {
  cards: OverviewCard[];
  suggestions: string[];
}

export function AdminOverview({ cards, suggestions }: AdminOverviewProps) {
  return (
    <>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col xs={24} md={12} xl={6} key={card.label}>
            <Card>
              <Statistic title={card.label} value={card.value} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="下一步建议"
        extra={<Typography.Text type="secondary">按 MVP 优先级排序</Typography.Text>}
        style={{ marginTop: 16 }}
      >
        <List dataSource={suggestions} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
    </>
  );
}
