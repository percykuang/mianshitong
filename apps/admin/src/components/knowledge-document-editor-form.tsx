'use client';

import { Form, Input, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import {
  KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS,
  KNOWLEDGE_DOCUMENT_CONTENT_SHAPE_OPTIONS,
} from '@/components/knowledge-document-options';

interface KnowledgeDocumentEditorFormProps {
  form: FormInstance;
}

export function KnowledgeDocumentEditorForm({ form }: KnowledgeDocumentEditorFormProps) {
  return (
    <Form layout="vertical" form={form} preserve={false}>
      <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
        <Input placeholder="React Hooks 面试手册" />
      </Form.Item>

      <Form.Item
        name="category"
        label="分类"
        rules={[{ required: true, message: '请选择文档分类' }]}
      >
        <Select options={[...KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS]} placeholder="选择文档分类" />
      </Form.Item>

      <Form.Item
        name="contentShape"
        label="内容形态"
        extra="流程型内容会在命中后按原始文档顺序展开，更适合面试流程、步骤说明、阶段说明。"
        rules={[{ required: true, message: '请选择内容形态' }]}
      >
        <Select
          options={[...KNOWLEDGE_DOCUMENT_CONTENT_SHAPE_OPTIONS]}
          placeholder="选择文档内容形态"
        />
      </Form.Item>

      <Form.Item
        name="tags"
        label="标签"
        rules={[{ required: true, type: 'array', min: 1, message: '请至少填写一个标签' }]}
      >
        <Select
          mode="tags"
          placeholder="输入与文档主题相关的标签"
          tokenSeparators={[',']}
          optionFilterProp="label"
        />
      </Form.Item>

      <Form.Item name="summary" label="摘要">
        <Input.TextArea rows={3} placeholder="可选，概括这份文档适合解决什么问题。" />
      </Form.Item>

      <Form.Item
        name="content"
        label="Markdown 内容"
        rules={[{ required: true, message: '请输入 Markdown 内容' }]}
      >
        <Input.TextArea
          rows={22}
          placeholder={'# 标题\n## 小节\n这里写与前端技术或面试打法相关的知识内容。'}
        />
      </Form.Item>

      <Form.Item name="isPublished" label="发布到知识库" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}
