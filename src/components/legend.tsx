export default function Legend() {
  return (
    <div className="h-full">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Timeline Legend</h3>
      <div className="space-y-4 text-sm text-gray-700">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 bg-[#f59e0b] flex-shrink-0"
            style={{ clipPath: "polygon(0% 0%, 50% 100%, 100% 0%)" }}
          ></div>
          <div>
            <p className="font-semibold">Copy Event</p>
            <p className="text-xs text-gray-600">
              Text was copied to clipboard
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 bg-[#8b5cf6] flex-shrink-0"
            style={{ clipPath: "polygon(0% 0%, 50% 100%, 100% 0%)" }}
          ></div>
          <div>
            <p className="font-semibold">Paste Event</p>
            <p className="text-xs text-gray-600">Text was pasted into editor</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 bg-[#10a37f] flex-shrink-0"
            style={{ clipPath: "polygon(0% 0%, 50% 100%, 100% 0%)" }}
          ></div>
          <div>
            <p className="font-semibold">GPT Inquiry</p>
            <p className="text-xs text-gray-600">
              User asked ChatGPT a question
            </p>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 italic">
            Click on any annotation marker on the timeline to jump to that
            event.
          </p>
        </div>
      </div>
    </div>
  );
}
