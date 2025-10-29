interface HorizontalBarProps {
  label: string;
  current: number;
  max: number;
  color?: string;
}

export default function HorizontalBar({
  label,
  current,
  max,
  color = "#4f46e5"
}: HorizontalBarProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3 py-2 w-full">
      <div className="text-base font-medium text-gray-700 flex-shrink-0 w-40 text-center">
        {label}
      </div>
      {/* Bar and value */}
      <div className="flex items-center gap-3 flex-grow">
        <div className="w-[90%] bg-gray-200 rounded-full h-6 relative overflow-hidden">
          {/* Percentile markers */}
          <div className="absolute inset-0 flex">
            <div className="w-[25%] border-r border-gray-400" />
            <div className="w-[25%] border-r border-gray-400" />
            <div className="w-[25%] border-r border-gray-400" />
            <div className="w-[25%]" />
          </div>
          {/* Progress bar */}
          <div
            className="h-full rounded-full transition-all duration-300 relative z-10"
            style={{
              width: `${percentage}%`,
              backgroundColor: color
            }}
          />
        </div>
        {/* Value text */}
        <div className="text-xs font-semibold text-gray-700 flex-shrink-0 min-w-[70px]">
          {current} / {max}
        </div>
      </div>
    </div>
  );
}
