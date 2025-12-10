import HorizontalBar from "./horizontalBar";
import { ParticipantStats } from "./types";

interface ParticipantStatsPanelProps {
  stats: ParticipantStats;
}

export default function ParticipantStatsPanel({ stats }: ParticipantStatsPanelProps) {
  return (
    <div className="space-y-4">
      <HorizontalBar
        label="Perceived Ownership"
        current={stats.po}
        max={7.0}
        color="#1f77b4"
      />
      <HorizontalBar
        label="User Words"
        current={stats.userWords}
        max={stats.totalWords || 1}
        color="#ff7f0e"
      />
      <HorizontalBar
        label="GPT Words"
        current={stats.gptWords}
        max={stats.totalWords || 1}
        color="#2ca02c"
      />
      <HorizontalBar
        label="Self Efficacy in Writing"
        current={stats.selfEfficacy}
        max={7.0}
        color="#d62728"
      />
      <HorizontalBar
        label="Technology Acceptance Model"
        current={stats.tamOverall}
        max={7.0}
        color="#9467bd"
      />
      <HorizontalBar
        label="Creativity Support Index"
        current={stats.csiTotal}
        max={7.0}
        color="#17becf"
      />

      {/* Statistics Table */}
      <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">
                Questions asked to ChatGPT
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                {stats.gptInquiry}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">
                Total Words
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                {stats.totalWords}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">
                Percentage of Final Essay Written by User
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                {stats.userPercent.toFixed(1)}%
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">
                Total Time
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                {Math.floor((stats.totalTime / 60))}m{" "}
                {Math.round((stats.totalTime % 60))}s
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
