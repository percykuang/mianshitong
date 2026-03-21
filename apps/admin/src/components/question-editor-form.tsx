'use client';

import { Form, Input, InputNumber, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import { QUESTION_LEVEL_OPTIONS, QUESTION_TAG_OPTIONS } from '@/components/question-bank-options';

interface QuestionEditorFormProps {
  form: FormInstance;
}

export function QuestionEditorForm({ form }: QuestionEditorFormProps) {
  return (
    <Form layout="vertical" form={form} preserve={false}>
      <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
        <Input placeholder="请你讲一下事件循环机制？" />
      </Form.Item>
      <Form.Item name="prompt" label="题目描述">
        <Input.TextArea rows={2} placeholder="可选，补充详细的题目描述或背景" />
      </Form.Item>
      <Form.Item name="answer" label="参考答案">
        <Input.TextArea rows={10} placeholder="可选，评估参考" />
      </Form.Item>
      <Form.Item name="level" label="难度" rules={[{ required: true, message: '请选择难度' }]}>
        <Select options={QUESTION_LEVEL_OPTIONS} placeholder="选择难度" />
      </Form.Item>
      <Form.Item
        name="tags"
        label="标签"
        rules={[{ required: true, type: 'array', min: 1, message: '请至少填写一个标签' }]}
      >
        <Select
          mode="tags"
          placeholder="选择或输入标签"
          tokenSeparators={[',']}
          options={QUESTION_TAG_OPTIONS}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item name="keyPointsText" label="要点（可选，每行一条）">
        <Input.TextArea rows={4} placeholder="要点 1\n要点 2" />
      </Form.Item>
      <Form.Item name="followUpsText" label="追问（可选，每行一条）">
        <Input.TextArea rows={3} placeholder="追问 1\n追问 2" />
      </Form.Item>
      <Form.Item name="order" label="序号">
        <InputNumber style={{ width: '100%' }} placeholder="可选，越小越靠前" />
      </Form.Item>
      <Form.Item name="isActive" label="启用" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}
