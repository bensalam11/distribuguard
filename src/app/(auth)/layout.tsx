import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-4 py-10">
      <div className="mb-6">
        <Logo inverted />
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">{children}</div>
      <p className="mt-6 max-w-md text-center text-xs text-brand-100">
        Savoir ce qui sort du dépôt, ce qui est livré, ce qui est encaissé, et combien de casiers sont dehors.
      </p>
    </main>
  );
}
