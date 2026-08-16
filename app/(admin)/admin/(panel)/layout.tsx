import Link from "next/link";
import { LogOut } from "lucide-react";
import { Toaster } from "sonner";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { logout } from "@/lib/actions/auth";
import { requireAdmin } from "@/lib/auth/current";

export const metadata = {
  robots: { index: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-svh bg-[#f4faf5]">
      <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col bg-pine-900 md:flex">
        <Link
          href="/admin"
          className="px-6 pt-6 pb-4 font-display text-lg font-bold text-white"
        >
          DaddyPromoos
          <span className="mt-0.5 block font-mono text-[0.6rem] font-normal tracking-[0.25em] text-mint/50 uppercase">
            Admin
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <AdminSidebar />
        </div>
        <div className="border-t border-white/10 p-3">
          <p className="truncate px-3 text-xs text-mint/50">{session.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-2.5 rounded-[var(--radius-btn)] px-3 py-2 text-sm font-medium text-mint/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile topbar */}
        <div className="flex items-center justify-between border-b border-line bg-pine-900 px-4 py-3 md:hidden">
          <Link href="/admin" className="font-display font-bold text-white">
            DaddyPromoos Admin
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-mint/70 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
        <main className="p-5 sm:p-8">
          <AdminBreadcrumb />
          {children}
        </main>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
