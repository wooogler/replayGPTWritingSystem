import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { Message } from "@/components/types";

type GPTProps = {
  messages?: Message[];
  pasteTexts?: string[];
};

export default function GPT({ messages = [], pasteTexts = [] }: GPTProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Function to highlight pasted text portions within message content
  const highlightPastedText = (content: string): React.ReactNode => {
    if (!pasteTexts || pasteTexts.length === 0) {
      return content;
    }

    let result: React.ReactNode = content;
    let highlightCount = 0;

    for (const pasteText of pasteTexts) {
      if (!pasteText || pasteText.trim().length === 0) continue;

      const trimmedPaste = pasteText.trim();

      // Convert paste text format to match message format:
      const formattedPaste = trimmedPaste.replace(/\\n/g, '\n');
      console.log(formattedPaste.length)

      const normalizedPaste = formattedPaste.replace(/\s+/g, ' ').slice(0,formattedPaste.length - 6);
      const lowerPaste = normalizedPaste.toLowerCase();

      if (typeof result === 'string') {
        const normalizedContent = result.replace(/\s+/g, ' ');
        const lowerContent = normalizedContent.toLowerCase();

        const matchIndex = lowerContent.indexOf(lowerPaste);
        if (matchIndex !== -1) {
          highlightCount++;

          result = (
            <span
              key={`highlight-${highlightCount}`}
              className="rounded px-1"
              style={{ backgroundColor: 'rgba(255, 220, 60, 0.60)' }}
            >
              {result}
            </span>
          );
        }
      }
    }

    return result;
  };




  return (
    <>
      <h3 className="flex items-center text-[24px] font-semibold text-gray-800 mb-3 pb-3 border-b border-gray-200">
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="#10a37f"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        ChatGPT Conversation
      </h3>
      <div className="flex flex-col border border-gray-200 rounded-lg bg-white overflow-y-auto overflow-x-hidden flex-grow">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 py-12">
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            <>
                {messages.map((m) => (
                console.log(m.content),
                <div
                  key={m.id}
                  className="flex w-full"
                >
                  {/* User messages */}
                  {m.role === "user" ? (
                    <div className="ml-auto w-[90%]">
                      <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-3 shadow-sm">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300">
                          <Image
                            width={24}
                            height={24}
                            src="/images/user-icon.png"
                            alt="User"
                            className="rounded-full"
                          />
                          <span className="font-semibold text-sm">User</span>
                        </div>
                        {/* Message content */}
                        <div className="whitespace-pre-wrap text-[20px]">
                          {highlightPastedText(m.content)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Assistant messages */
                    <div className="mr-auto w-[90%]">
                      <div className="bg-gray-200 text-gray-900 rounded-2xl px-4 py-3 shadow-sm">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300">
                          <Image
                            width={24}
                            height={24}
                            src="/images/chatgpt-icon.png"
                            alt="ChatGPT"
                            className="rounded-full"
                          />
                          <span className="font-semibold text-sm">ChatGPT</span>
                        </div>
                        {/* Message content */}
                        <div className="whitespace-pre-wrap text-[20px]">
                          {highlightPastedText(m.content)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {/* Invisible div for auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
