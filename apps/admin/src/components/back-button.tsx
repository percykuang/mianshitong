'use client';

import { useRouter } from 'next/navigation';
import { Button } from 'antd';
import { LeftOutlined } from '@ant-design/icons';

export function BackButton() {
  const router = useRouter();

  return (
    <Button
      type="text"
      size="small"
      icon={<LeftOutlined style={{ fontSize: 16, fontWeight: 700 }} />}
      onClick={() => router.back()}
      style={{
        padding: 0,
        width: 32,
        minWidth: 32,
        height: 24,
        fontSize: 16,
        color: '#111827',
      }}
      aria-label="返回"
    />
  );
}
