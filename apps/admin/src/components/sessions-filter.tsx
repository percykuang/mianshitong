'use client';

import type { ActorType, SessionStatus } from '@mianshitong/shared';
import { Button, DatePicker, Drawer, Form, Input, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterActionButton } from '@/components/admin-filter-action-button';
import { buildPageHref } from '@/lib/pagination';

const { RangePicker } = DatePicker;

interface SessionsFilterProps {
  userId: string;
  user: string;
  title: string;
  actorType: ActorType | '';
  status: SessionStatus | '';
  updatedFrom: string;
  updatedTo: string;
  pageSize: number;
}

interface SessionsFilterFormValues {
  userId?: string;
  user?: string;
  actorType?: ActorType | '';
  status?: SessionStatus | '';
  updatedRange?: [Dayjs | null, Dayjs | null];
}

const ACTOR_TYPE_OPTIONS = [
  { label: '全部用户', value: '' },
  { label: '访客', value: 'guest' },
  { label: '注册用户', value: 'registered' },
] as const;

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '空闲', value: 'idle' },
  { label: '面试中', value: 'interviewing' },
  { label: '已完成', value: 'completed' },
] as const;

function toRangeValue(
  updatedFrom: string,
  updatedTo: string,
): [Dayjs | null, Dayjs | null] | undefined {
  const start = updatedFrom ? dayjs(updatedFrom) : null;
  const end = updatedTo ? dayjs(updatedTo) : null;

  if (!start && !end) {
    return undefined;
  }

  return [start, end];
}

export function SessionsFilter({
  userId,
  user,
  title,
  actorType,
  status,
  updatedFrom,
  updatedTo,
  pageSize,
}: SessionsFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(title);
  const [form] = Form.useForm<SessionsFilterFormValues>();

  const appliedFormValues = useMemo<SessionsFilterFormValues>(
    () => ({
      userId,
      user,
      actorType,
      status,
      updatedRange: toRangeValue(updatedFrom, updatedTo),
    }),
    [userId, user, actorType, status, updatedFrom, updatedTo],
  );

  useEffect(() => {
    setSearchValue(title);
  }, [title]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    form.setFieldsValue(appliedFormValues);
  }, [appliedFormValues, drawerOpen, form]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmedTitle = searchValue.trim();
      if (trimmedTitle === title) {
        return;
      }

      router.replace(
        buildPageHref(pathname, 1, pageSize, {
          title: trimmedTitle,
          userId,
          user,
          actorType,
          status,
          updatedFrom,
          updatedTo,
        }),
      );
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    actorType,
    pageSize,
    pathname,
    router,
    searchValue,
    status,
    title,
    updatedFrom,
    updatedTo,
    user,
    userId,
  ]);

  const activeAdvancedFilterCount = [
    userId,
    user,
    actorType,
    status,
    updatedFrom || updatedTo,
  ].filter(Boolean).length;
  const hasAnyActiveFilter =
    [title, userId, user, actorType, status, updatedFrom || updatedTo].filter(Boolean).length > 0;

  const handleConfirm = async () => {
    const values = await form.validateFields();
    const [rangeStart, rangeEnd] = values.updatedRange ?? [];

    router.replace(
      buildPageHref(pathname, 1, pageSize, {
        title: searchValue.trim(),
        userId: values.userId?.trim(),
        user: values.user?.trim(),
        actorType: values.actorType,
        status: values.status,
        updatedFrom: rangeStart?.format('YYYY-MM-DD'),
        updatedTo: rangeEnd?.format('YYYY-MM-DD'),
      }),
    );
    setDrawerOpen(false);
  };

  const handleCancel = () => {
    form.setFieldsValue(appliedFormValues);
    setDrawerOpen(false);
  };

  const handleClearAll = () => {
    setSearchValue('');
    setDrawerOpen(false);
    router.replace(buildPageHref(pathname, 1, pageSize, {}));
  };

  return (
    <>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
        }}
      >
        <Input
          allowClear
          value={searchValue}
          placeholder="搜索会话标题"
          onChange={(event) => setSearchValue(event.target.value)}
          style={{ width: 260 }}
        />
        <AdminFilterActionButton
          label={activeAdvancedFilterCount > 0 ? `筛选（${activeAdvancedFilterCount}）` : '筛选'}
          hasActiveFilters={hasAnyActiveFilter}
          onOpen={() => setDrawerOpen(true)}
          onClear={handleClearAll}
        />
      </div>

      <Drawer
        title="筛选"
        placement="right"
        width={420}
        open={drawerOpen}
        onClose={handleCancel}
        closeIcon={false}
        destroyOnHidden={false}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={() => void handleConfirm()}>
              确定
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" initialValues={appliedFormValues}>
          <Form.Item label="用户 ID" name="userId">
            <Input allowClear placeholder="按用户 ID 或 actor ID 筛选" />
          </Form.Item>

          <Form.Item label="用户名 / 邮箱" name="user">
            <Input allowClear placeholder="按用户名或邮箱筛选" />
          </Form.Item>

          <Form.Item label="用户类型" name="actorType">
            <Select
              options={ACTOR_TYPE_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
            />
          </Form.Item>

          <Form.Item label="会话状态" name="status">
            <Select
              options={STATUS_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
            />
          </Form.Item>

          <Form.Item label="更新时间范围" name="updatedRange">
            <RangePicker
              allowClear
              allowEmpty={[true, true]}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
