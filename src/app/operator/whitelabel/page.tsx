'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import WhiteLabelConfig from '@/components/admin/WhiteLabelConfig';

export default function OperatorWhiteLabelPage() {
  const router = useRouter();

  return (
    <WhiteLabelConfig
      onBack={() => {
        router.push('/operator/dashboard');
      }}
    />
  );
}
