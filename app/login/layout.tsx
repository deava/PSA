import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your Worklo account.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
