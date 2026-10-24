export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <path
          d="M16 2 4 7v8c0 7.4 5.1 13.4 12 15 6.9-1.6 12-7.6 12-15V7L16 2Z"
          fill={inverted ? "#ffffff" : "#102c52"}
        />
        <path
          d="m10.5 16 4 4 7-8"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-lg font-bold tracking-tight ${inverted ? "text-white" : "text-brand-900"}`}>
        Distribu<span className="text-accent-500">Guard</span>
      </span>
    </span>
  );
}
