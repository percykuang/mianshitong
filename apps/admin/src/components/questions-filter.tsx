'use client';

import { Button, Form, Input, Select, Space } from 'antd';
import { useRouter } from 'next/navigation';
import { buildPageHref } from '@/lib/pagination';
import {
  QUESTION_LEVEL_OPTIONS,
  QUESTION_TAG_OPTIONS,
  normalizeQuestionTags,
} from '@/components/question-bank-options';

const STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

interface QuestionsFilterProps {
  tags: string[];
  level: string;
  status: string;
  keyword: string;
  pageSize: number;
}

export function QuestionsFilter({ tags, level, status, keyword, pageSize }: QuestionsFilterProps) {
  const router = useRouter();
  const [form] = Form.useForm();

  const handleFinish = (values: {
    tags?: string[];
    level?: string;
    status?: string;
    keyword?: string;
  }) => {
    const nextTags = normalizeQuestionTags(values.tags);
    router.push(
      buildPageHref('/questions', 1, pageSize, {
        tags: nextTags.length > 0 ? nextTags.join(',') : undefined,
        level: values.level?.trim(),
        status: values.status?.trim(),
        keyword: values.keyword?.trim(),
      }),
    );
  };

  const handleValuesChange = () => {
    handleFinish(form.getFieldsValue());
  };

  const handleReset = () => {
    form.resetFields();
    router.push('/questions');
  };

  return (
    <Form
      form={form}
      layout="inline"
      initialValues={{ tags, level, status, keyword }}
      onFinish={handleFinish}
      onValuesChange={handleValuesChange}
      style={{ marginBottom: 16, justifyContent: 'flex-end' }}
    >
      <Form.Item name="tags">
        <Select
          mode="tags"
          allowClear
          placeholder="标签"
          options={QUESTION_TAG_OPTIONS}
          optionFilterProp="label"
          tokenSeparators={[',']}
          style={{ minWidth: 200 }}
        />
      </Form.Item>
      <Form.Item name="level">
        <Select
          allowClear
          placeholder="难度"
          options={QUESTION_LEVEL_OPTIONS}
          style={{ width: 120 }}
        />
      </Form.Item>
      <Form.Item name="status">
        <Select allowClear placeholder="状态" options={STATUS_OPTIONS} style={{ width: 120 }} />
      </Form.Item>
      <Form.Item name="keyword">
        <Input placeholder="关键词" allowClear />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            筛选
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
