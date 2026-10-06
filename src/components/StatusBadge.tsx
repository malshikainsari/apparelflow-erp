const STATUS: Record<string, { label: string; box: string; dot: string }> = {
  PENDING_VERIFICATION: {
    label: "Pending verification",
    box: "border-amber-700 bg-amber-50 text-amber-900",
    dot: "bg-amber-600",
  },
  REJECTED: {
    label: "Rejected",
    box: "border-red-700 bg-red-50 text-red-900",
    dot: "bg-red-600",
  },
  VERIFIED: {
    label: "Verified",
    box: "border-green-700 bg-green-50 text-green-900",
    dot: "bg-green-600",
  },
  SEWING_STARTED: {
    label: "Sewing started",
    box: "border-gray-700 bg-gray-100 text-gray-900",
    dot: "bg-gray-700",
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.SEWING_STARTED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.box}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}