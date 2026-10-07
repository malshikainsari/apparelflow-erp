type Light = "GREEN" | "YELLOW" | "RED" | null;

const MAP = {
  GREEN: { label: "Match", box: "border-green-700 bg-green-50 text-green-900", dot: "bg-green-600" },
  YELLOW: { label: "Excess", box: "border-amber-700 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  RED: { label: "Shortage", box: "border-red-700 bg-red-50 text-red-900", dot: "bg-red-600" },
} as const;

export default function TrafficLight({ status }: { status: Light }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-500 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-900">
        <span className="h-2 w-2 rounded-full bg-gray-500" aria-hidden />
        Not counted
      </span>
    );
  }
  const s = MAP[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.box}`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}