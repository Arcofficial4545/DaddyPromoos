import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <div className="flex min-h-svh items-center justify-center bg-pine-900 px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-2xl font-bold text-white">
          DaddyPromoos
        </p>
        <p className="mt-1 text-center font-mono text-xs tracking-[0.2em] text-mint/60 uppercase">
          Admin portal
        </p>
        <div className="mt-8 rounded-[var(--radius-card)] bg-white p-8 shadow-lg">
          <LoginForm from={from} />
        </div>
      </div>
    </div>
  );
}
