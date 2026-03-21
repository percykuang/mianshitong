'use client';

import { App, Button, Card, Form, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackButton } from '@/components/back-button';
import { QuestionEditorForm } from '@/components/question-editor-form';
import { normalizeQuestionTags } from '@/components/question-bank-options';

type QuestionPayload = {
  level: string;
  title: string;
  prompt: string | null;
  answer: string | null;
  keyPoints: string[];
  followUps: string[];
  tags: string[];
  order: number | null;
  isActive: boolean;
};

type QuestionFormValues = {
  level: string;
  title: string;
  prompt?: string;
  answer?: string;
  keyPointsText?: string;
  followUpsText?: string;
  tags?: string[];
  order?: number;
  isActive?: boolean;
};

function fromLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function QuestionCreateView() {
  const headerHeight = 56;
  const footerHeight = 64;
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({ isActive: true, tags: [] });
  }, [form]);

  const buildPayload = async (): Promise<QuestionPayload | null> => {
    let values: QuestionFormValues;
    try {
      values = (await form.validateFields()) as QuestionFormValues;
    } catch {
      return null;
    }
    const tags = normalizeQuestionTags(values.tags);
    if (tags.length === 0) {
      message.error('请至少填写一个标签');
      return null;
    }

    return {
      level: values.level,
      title: values.title.trim(),
      prompt: values.prompt?.trim() || null,
      answer: values.answer?.trim() || null,
      keyPoints: fromLines(values.keyPointsText ?? ''),
      followUps: fromLines(values.followUpsText ?? ''),
      tags,
      order: typeof values.order === 'number' ? values.order : null,
      isActive: Boolean(values.isActive),
    };
  };

  const persistQuestion = async (mode: 'exit' | 'continue') => {
    if (saving) {
      return;
    }
    const payload = await buildPayload();
    if (!payload) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/question-bank/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        message.error(result.message || '保存失败');
        return;
      }
      message.success('题目已创建');

      if (mode === 'continue') {
        const sticky = {
          level: payload.level,
          tags: payload.tags,
          isActive: payload.isActive,
        };
        form.resetFields();
        form.setFieldsValue({
          title: '',
          prompt: '',
          answer: '',
          keyPointsText: '',
          followUpsText: '',
          order: undefined,
          ...sticky,
        });
        return;
      }

      router.push('/questions');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 32px',
        }}
      >
        <BackButton />
        <Typography.Title level={3} style={{ margin: 0, fontSize: 20 }}>
          新建题目
        </Typography.Title>
      </header>
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 32px 24px' }}>
          <Card title="题目信息">
            <QuestionEditorForm form={form} />
          </Card>
        </div>
      </main>
      <footer
        style={{
          height: footerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: '1px solid #e5e7eb',
          background: '#ffffff',
          padding: '0 32px',
        }}
      >
        <Space>
          <Button onClick={() => void persistQuestion('continue')} loading={saving}>
            保存并继续添加
          </Button>
          <Button type="primary" onClick={() => void persistQuestion('exit')} loading={saving}>
            保存
          </Button>
        </Space>
      </footer>
    </div>
  );
}
