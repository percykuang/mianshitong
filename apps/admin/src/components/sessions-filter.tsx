'use client';

import { Button, Form, Input, Space } from 'antd';
import { useRouter } from 'next/navigation';
import { buildPageHref } from '@/lib/pagination';

interface SessionsFilterProps {
  userId: string;
  user: string;
  title: string;
  pageSize: number;
}

export function SessionsFilter({ userId, user, title, pageSize }: SessionsFilterProps) {
  const router = useRouter();
  const [form] = Form.useForm();

  const handleFinish = (values: { userId?: string; user?: string; title?: string }) => {
    router.push(
      buildPageHref('/sessions', 1, pageSize, {
        userId: values.userId?.trim(),
        user: values.user?.trim(),
        title: values.title?.trim(),
      }),
    );
  };

  const handleValuesChange = () => {
    const values = form.getFieldsValue();
    handleFinish(values);
  };

  const handleReset = () => {
    form.resetFields();
    router.push('/sessions');
  };

  return (
    <Form
      form={form}
      layout="inline"
      initialValues={{ userId, user, title }}
      onFinish={handleFinish}
      onValuesChange={handleValuesChange}
      style={{ marginBottom: 16, justifyContent: 'flex-end' }}
    >
      <Form.Item name="userId">
        <Input placeholder="用户 ID" allowClear />
      </Form.Item>
      <Form.Item name="user">
        <Input placeholder="用户名 / 邮箱" allowClear />
      </Form.Item>
      <Form.Item name="title">
        <Input placeholder="会话标题" allowClear />
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
