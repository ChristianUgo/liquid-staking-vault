import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
import { Shell } from '../components/Shell';

export const metadata: Metadata = {
  title: 'Beacon Lite | Liquid Staking Foundation',
  description: 'A transparent educational liquid staking foundation and risk simulator.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><Providers><Shell>{children}</Shell></Providers></body></html>;
}
