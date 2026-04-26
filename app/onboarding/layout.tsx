export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4">
      {children}
    </div>
  );
}
