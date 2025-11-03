"use client"
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { Message, CSVdata, TimelineEvent, ParticipantStats } from "@/components/types";
import Prompt from "@/components/prompt";
import GPT from "@/components/gpt";
import SliderComponent from "@/components/sliderComponent";
import Toast from "@/components/toast";
import Legend from "@/components/legend";
import { CodePlay } from "codemirror-record";
import dynamic from 'next/dynamic';
import type { ReplayHandle } from "@/components/replay";
import HorizontalBar from "@/components/horizontalBar";


const Replay = dynamic(() => import('@/components/replay'), {
  ssr: false,
  loading: () => <div>Loading Replay Editor...</div>,
});


async function loadCSV() {
  try {
    // Fetch the CSV file
    const response = await fetch("/data/replay_data.csv");
    const csvText = await response.text();

    // Parse CSV using Papaparse
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (result.errors.length > 0) {
      console.warn("CSV parsing warnings:", result.errors);
    }

    console.log("Parsed CSV data:", result.data);
    console.log("Header:", result.meta.fields);
    return result.data;
  } catch (error) {
    console.error("Error loading CSV:", error);
    return null;
  }
}

//TODO: 

export default function Home() {
  const searchParams = useSearchParams();
  const participantParam = searchParams.get("participant") || "p1";
  const essayNum = parseInt(participantParam.replace("p", ""));

  const [messReplay, setMessReplay] = useState<Message[]>([]);
  const [isPromptVisible, setisPromptVisible] = useState(false);
  const [isLegendVisible, setIsLegendVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const totalDurationRef = useRef(0);
  const speed = useRef(1.0);
  const playing = useRef(false);
  const playCodeMirrorRef = useRef<ReplayHandle>(null);
  const codePlayerRef = useRef<CodePlay | null>(null);
  const [recording, setRecording] = useState<string>("");
  const allMessagesRef = useRef<Message[]>([]);
  const messagePlaybackActive = useRef(false);
  const timelineEventsRef = useRef<TimelineEvent[]>([]);
  const pasteTextsRef = useRef<string[]>([]);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const lastCopyIndexRef = useRef(0);
  const dataArrayRef = useRef<any[]>([]);
  const [isGraphsVisible, setIsGraphsVisible] = useState(false);
  const [participantStats, setParticipantStats] = useState<ParticipantStats>({
    po: 0,
    userWords: 0,
    gptWords: 0,
    totalWords: 0,
  });

  const startProgressTracking = () => {
    const updateProgress = () => {
      if (totalDurationRef.current > 0 && codePlayerRef.current) {
        const currentTimeMs = codePlayerRef.current.getCurrentTime() || 0;
        const currentTimeSec = currentTimeMs / 1000;
        const progress = (currentTimeSec / totalDurationRef.current) * 100;

        // Functional updating to avoid unnecessary re-renders
        setCurrentProgress((prev) => {
          const newProgress = Math.min(progress, 100);
          if (Math.abs(newProgress - prev) > 0.01) {
            return newProgress;
          }
          return prev;
        });

        // Check for copy events and show toast
        const copyEvents = timelineEventsRef.current.filter(
          (e) => e.type === "copy"
        );
        for (let i = lastCopyIndexRef.current; i < copyEvents.length; i++) {
          if (copyEvents[i].time <= currentTimeSec) {
            setShowCopyToast(true);
            lastCopyIndexRef.current = i + 1;
          } else {
            break;
          }
        }
      }
      requestAnimationFrame(updateProgress);
    };
    requestAnimationFrame(updateProgress);
  };

  useEffect(() => {
    // Load participant statistics
    const loadParticipantStats = async () => {
      try {
        const response = await fetch("/data/part_info.csv");
        const csvText = await response.text();

        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        const participantData: any = result.data.find((row: any) => parseInt(row.id) === essayNum);

        if (participantData) {
          setParticipantStats({
            po: parseFloat(participantData["Percieved Ownership"]) || 0,
            userWords: parseInt(participantData["User Final Words"]) || 0,
            gptWords: parseInt(participantData["GPT Final Words"]) || 0,
            totalWords: parseInt(participantData["Total Words"]) || 0,
          });
        }
      } catch (error) {
        console.error("Error loading participant stats:", error);
      }
    };

    loadParticipantStats();

    let attempts = 0;
    const maxAttempts = 20;

    const checkEditor = setInterval(() => {
      const editor = playCodeMirrorRef.current?.getEditor();
      attempts++;

      if (editor) {
        console.log(`Editor ready, loading participant ${participantParam}`);
        clearInterval(checkEditor);

        // Load data and set initial editor state
        handleLoadArrays();
      } else if (attempts >= maxAttempts) {
        console.error(
          "Editor failed to initialize after",
          maxAttempts,
          "attempts"
        );
        clearInterval(checkEditor);
      }
    }, 200);

    return () => clearInterval(checkEditor);
  }, []);

  const getTimelineEvents = (data) => {
    let newTimelineEvents: TimelineEvent[] = [];
    let newPasteTexts: string[] = [];
    for (const element of data) {
      if (element.op_type === "y") {
        newTimelineEvents.push({ time: element.time, type: "copy" });
      }

      if (element.op_type === "p") {
        newTimelineEvents.push({ time: element.time, type: "paste" });
        newPasteTexts.push(element.add || "");
      }
      if (element.op_type === "gpt_inquiry") {
        newTimelineEvents.push({ time: element.time, type: "gpt_inquiry" });
      }
    }
    newTimelineEvents.sort((a, b) => a.time - b.time);

    timelineEventsRef.current = newTimelineEvents;
    pasteTextsRef.current = newPasteTexts;
    console.log("Timeline events found:", newTimelineEvents.length);
    console.log(
      "  - GPT inquiries:",
      newTimelineEvents.filter((e) => e.type === "gpt_inquiry").length
    );
    console.log(
      "  - Copy events:",
      newTimelineEvents.filter((e) => e.type === "copy").length
    );
    console.log(
      "  - Paste events:",
      newTimelineEvents.filter((e) => e.type === "paste").length
    );
    console.log("Paste texts captured:", newPasteTexts.length);
    console.log("Sample paste texts:", newPasteTexts.slice(0, 3));
  }


  const handleLoadArrays = async (): Promise<void> => {
    const allData = (await loadCSV()) as CSVdata;
    if (allData) {
      // Filter data by essay_num matching selected participant
      const data = allData.filter((row: any) => row.essay_num === essayNum);

      if (data.length === 0) {
        console.error(`No data found for participant ${participantParam} (essay_num: ${essayNum})`);
        return;
      }

      console.log(`Loaded ${data.length} rows for participant ${participantParam} (essay_num: ${essayNum})`);

      // Store data array for seeking functionality
      dataArrayRef.current = data;

      // Set initial editor state from first row
      if (data[0] && data[0].current_editor) {
        try {
          const editorState = parseRecordingObj(data[0].current_editor);
          const initialLines = JSON.parse(editorState);
          const initialState = ('\n\n\n\n');
          const editor = playCodeMirrorRef.current?.getEditor();
          if (editor) {
            editor.setValue(initialState);
          }
        } catch (e) {
          console.error("Failed to parse initial editor state:", e);
          console.error("Raw value:", data[0].current_editor);
        }
      }

      const newRecordings: string[] = [];
      const newMessages: Message[] = [];
      let messageIndex = 0;

      for (const element of data) {
        switch (element.op_loc) {
          case "editor":
            let record = element.recording_obj;

            if (!record) {
              console.warn("Skipping null recording_obj for element");
              break;
            }

            // Convert single quotes to double quotes for valid JSON
            record = record.replace(/: '([\s\S]*?)'/g, (match, content) => {
              if (match === ": '[") return match;
              const escaped = content.replace(/"/g, '\\"');
              return `: '${escaped}'`;
            });

            // Replace structural single quotes with double quotes
            record = record.replace(/\{'/g, '{"');
            record = record.replace(/':/g, '":');
            record = record.replace(/, '/g, ', "');
            record = record.replace(/\['/g, '["');
            record = record.replace(/'(\})/g, '"$1');
            record = record.replace(/'(\])/g, '"$1');
            record = record.replace(/'(,)/g, '"$1');
            record = record.replace(/: '/g, ': "');

            newRecordings.push(record);
            break;
          case "gpt":
              if(element.op_type === "gpt_inquiry" || element.op_type === "gpt_response"){
                const newMessage: Message = {
                id: messageIndex,
                role: element.op_type === "gpt_inquiry" ? "user" : "assistant",
                content: element.selected_text || "",
                time: element.time,
              };
              messageIndex += 1;
              newMessages.push(newMessage);

              console.log(`Message ${messageIndex}: time=${element.time}, content=${element.selected_text?.substring(0, 50)}...`);
            }
            break;
        }

      }

      console.log("Total messages found:", newMessages.length);

      // Store all messages for seek functionality
      allMessagesRef.current = newMessages;

      const combinedRecording = "[" + newRecordings.join(", ") + "]";
      setRecording(combinedRecording);

      // Initialize CodePlayer
      const codePlayer = new CodePlay(playCodeMirrorRef.current?.getEditor()!, {
        autoplay: false,
        speed: speed.current
      });
      codePlayerRef.current = codePlayer;
      codePlayer.addOperations(combinedRecording);

      // Get total duration
      const durationMs = codePlayer.getDuration();
      const duration = durationMs / 1000;
      totalDurationRef.current = duration;
      setTotalDuration(duration);
      console.log("Total duration:", duration, "seconds (", durationMs, "ms)");

      // Start message playback
      playMessages(newMessages);

      getTimelineEvents(data);

      // Start progress tracking
      startProgressTracking();
    }
  };

  const playMessages = (messagesToPlay: Message[]): void => {
    if (messagesToPlay.length === 0) {
      console.log("No messages to play");
      return;
    }

    console.log("Starting message playback with", messagesToPlay.length, "messages");

    messagePlaybackActive.current = true;

    // Sync messages with current playback time
    const syncMessages = () => {
      if (!messagePlaybackActive.current) return;

      if (codePlayerRef.current) {
        // Get current time from CodePlay
        const currentTimeMs = codePlayerRef.current.getCurrentTime() || 0;
        const currentTimeSec = currentTimeMs / 1000;

        // Find messages that should be visible at current time
        const messagesToShow = allMessagesRef.current.filter(msg => msg.time <= currentTimeSec);

        // Update messages
        setMessReplay(prev => {
          if (prev.length !== messagesToShow.length) {
            return messagesToShow;
          }
          return prev;
        });
      }

      requestAnimationFrame(syncMessages);
    };

    requestAnimationFrame(syncMessages);
  };

    // Helper function to parse recording_obj from CSV data
    const parseRecordingObj = (record: string): string => {
      // Convert single quotes to double quotes for valid JSON
      record = record.replace(/: '([\s\S]*?)'/g, (match, content) => {
        if (match === ": '[") return match;
        const escaped = content.replace(/"/g, '\\"');
        return `: '${escaped}'`;
      });

      // Replace structural single quotes with double quotes
      record = record.replace(/\{'/g, '{"');
      record = record.replace(/':/g, '":');
      record = record.replace(/, '/g, ', "');
      record = record.replace(/\['/g, '["');
      record = record.replace(/'(\})/g, '"$1');
      record = record.replace(/'(\])/g, '"$1');
      record = record.replace(/'(,)/g, '"$1');
      record = record.replace(/: '/g, ': "');

      return record;
    };

    // Helper function to build recording from a specific index
    const buildRecordingFromIndex = (data: any[], startIndex: number): string => {
      const newRecordings: string[] = [];

      for (let i = startIndex; i < data.length; i++) {
        const element = data[i];
        if (element.op_loc === "editor" && element.recording_obj) {
          const record = parseRecordingObj(element.recording_obj);
          newRecordings.push(record);
        }
      }

      return "[" + newRecordings.join(", ") + "]";
    };

    const handleSpeedChange = (newSpeed) => {
      console.log("Speed changed to:", newSpeed);
      speed.current = newSpeed;

      // Update CodePlay speed
      if (codePlayerRef.current) {
        codePlayerRef.current.setSpeed(newSpeed);
      }

    };

    const handlePlayChange = (isPlaying) => {
      console.log("Play state changed to:", isPlaying);
      playing.current = isPlaying;

      // Control CodePlay playback
      if (codePlayerRef.current) {
        if (isPlaying) {
          codePlayerRef.current.play();
        } else {
          codePlayerRef.current.pause();
        }
      }
    };

    const handleSeek = (percentage: number) => {
      console.log("Seeking to:", percentage.toFixed(3), "%");

      if (totalDuration === 0 || dataArrayRef.current.length === 0) return;

      const data = dataArrayRef.current;
      const editor = playCodeMirrorRef.current?.getEditor();
      if (!editor) return;

      // Calculate target time
      const targetTimeSec = (percentage / 100) * totalDuration;
      const targetTimeMs = targetTimeSec * 1000;

      console.log("Target time:", targetTimeSec.toFixed(2), "seconds");

      // Save current playback state
      const wasPlaying = codePlayerRef.current?.getStatus() === 'PLAY';

      // Pause current playback
      if (codePlayerRef.current) {
        codePlayerRef.current.pause();
      }

      // Find the element index closest to target time
      let seekIndex = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i].time <= targetTimeSec) {
          seekIndex = i;
        } else {
          break;
        }
      }

      console.log(`Seeking to element index ${seekIndex} at time ${data[seekIndex]?.time || 0}s`);

      // Find element with current_editor (backtrack if needed)
      let editorStateIndex = seekIndex;
      while (editorStateIndex >= 0 && !data[editorStateIndex].current_editor) {
        editorStateIndex--;
      }

      // Set editor to target state
      if (editorStateIndex >= 0 && data[editorStateIndex].current_editor) {
        try {
          const editorState = parseRecordingObj(data[editorStateIndex].current_editor);
          const lines = JSON.parse(editorState);
          const stateText = lines.join('\n');
          editor.setValue(stateText);

          console.log(`Set editor to state from index ${editorStateIndex}`);
        } catch (e) {
          console.error("Failed to parse editor state at seek position:", e);
        }
      }

      // Build new recording from seek position forward
      const newRecording = buildRecordingFromIndex(data, seekIndex);
      console.log(`Built new recording from index ${seekIndex}`);

      // Create new CodePlayer instance
      const newCodePlayer = new CodePlay(editor, {
        autoplay: false,
        speed: speed.current
      });

      newCodePlayer.addOperations(newRecording);
      console.log(`Added operations to new CodePlayer`);

      // Set CodePlayer's internal time to match seek position (Approach B)
      newCodePlayer.lastOperationTime = targetTimeMs;
      newCodePlayer.playedTimeBeforeOperation = 0;
      console.log(`Set CodePlayer lastOperationTime to ${targetTimeMs}ms`);

      // Replace old CodePlayer
      codePlayerRef.current = newCodePlayer;

      // Update messages to show only messages up to seek time
      const messagesToShow = allMessagesRef.current.filter(msg => msg.time <= targetTimeSec);
      setMessReplay(messagesToShow);
      console.log(`Showing ${messagesToShow.length} messages up to seek position`);

      // Reset copy event tracking based on seek position
      const copyEvents = timelineEventsRef.current.filter(e => e.type === 'copy');
      let newCopyIndex = 0;
      for (let i = 0; i < copyEvents.length; i++) {
        if (copyEvents[i].time <= targetTimeSec) {
          newCopyIndex = i + 1;
        } else {
          break;
        }
      }
      lastCopyIndexRef.current = newCopyIndex;

      // Update progress
      setCurrentProgress(percentage);

      // Resume playback after delay if was playing
      if (wasPlaying) {
        setTimeout(() => {
          newCodePlayer.play();
          console.log("Resumed playback after delay");
        }, 500);
      }

      console.log(`Seek complete to ${targetTimeSec.toFixed(2)}s`);
    };

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {/* Toast notification for copy events */}
      <Toast
        message="Text copied"
        isVisible={showCopyToast}
        onClose={() => setShowCopyToast(false)}
        duration={2000}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Essay Writing Replay - Participant {essayNum + 1}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Interactive playback of essay writing sessions with ChatGPT
          </p>
        </div>
      </header>

      <main className="px-6 py-5 flex h-[calc(100vh-9rem)]">
        {/* Sliding Prompt Panel */}
        <div
          className={`transition-all duration-300 flex-shrink-0 ${
            isPromptVisible ? "w-[25%]" : "w-0"
          }`}
        >
          <div
            className={`h-full flex items-start overflow-hidden ${
              isPromptVisible ? "opacity-100" : "opacity-0"
            } transition-opacity duration-300`}
          >
            <div className="ml-4 border rounded-xl border-gray-200 bg-white p-4 w-full h-full flex flex-col overflow-auto shadow-lg">
              <Prompt />
            </div>
          </div>
        </div>

        {/* Toggle Prompt button */}
        <button
          onClick={() => setisPromptVisible(!isPromptVisible)}
          className={`bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 h-fit flex items-center justify-center shadow-xl hover:shadow-2xl transition-all z-50 flex-shrink-0 self-start ${
            isPromptVisible ? "mx-2" : "mr-2"
          }`}
        >
          <span className="text-sm font-medium">
            {isPromptVisible ? "← Hide" : "Prompt →"}
          </span>
        </button>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <div
            id="frames"
            className={`flex justify-center h-full gap-4 transition-all duration-300 ${
              isPromptVisible ? "w-full" : "w-full"
            }`}
          >
            <div
              className={`border rounded-xl shadow-xl border-gray-200 p-5 transition-all duration-300 bg-white ${
                isPromptVisible ? "w-[55%]" : "w-1/2"
              } flex flex-col`}
            >
              <Replay ref={playCodeMirrorRef} />
            </div>
            <div
              className={`border rounded-xl shadow-xl border-gray-200 p-5 bg-white ${
                isPromptVisible ? "w-[45%]" : "w-1/2"
              } flex flex-col`}
            >
              <GPT messages={messReplay} pasteTexts={pasteTextsRef.current} />
            </div>
          </div>
        </div>

        {/* Toggle Graphs button */}
        <button
          onClick={() => setIsGraphsVisible(!isGraphsVisible)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 h-fit w-28 flex items-center justify-center shadow-xl hover:shadow-2xl transition-all z-50 flex-shrink-0 self-start ml-2"
        >
          <span className="text-sm font-medium">
            {isGraphsVisible ? "Hide →" : "← Graphs"}
          </span>
        </button>
      </main>

      {/* Sliding Graph Panel */}
      <div
        className={`fixed bg-white border-l border-gray-200 overflow-y-auto transition-all duration-300 z-40 ${
          isGraphsVisible ? "right-0" : "-right-[25%]"
        }`}
        style={{
          width: '25%',
          top: '5.5rem',
          bottom: '3.6rem',
          height: 'auto'
        }}
      >
        <div className="h-full flex flex-col p-6 pt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-8">Participant Statistics</h2>
          <div className="space-y-4">
            <HorizontalBar
              label="Perceived Ownership"
              current={participantStats.po}
              max={7.0}
              color="#6366f1"
            />
            <HorizontalBar
              label="User Words"
              current={participantStats.userWords}
              max={participantStats.totalWords || 1}
              color="#8b5cf6"
            />
            <HorizontalBar
              label="GPT Words"
              current={participantStats.gptWords}
              max={participantStats.totalWords || 1}
              color="#10a37f"
            />
          </div>
        </div>
      </div>

      {/* Controls footer with Legend */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-3 px-6">
        {/* Slide-up Legend Panel */}
        <div
          className={`absolute right-6 bg-gray-50 rounded-t-lg border border-gray-200 shadow-xl transition-all duration-300 overflow-hidden ${
            isLegendVisible
              ? "bottom-full mb-0 opacity-100"
              : "bottom-0 opacity-0 pointer-events-none"
          }`}
          style={{ width: "320px" }}
        >
          <div className="p-4">
            <Legend />
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center w-full justify-center">
          <div className="flex-grow max-w-[calc(100%-120px)] mr-2">
            <SliderComponent
              onSpeedChange={handleSpeedChange}
              onPlayChange={handlePlayChange}
              onSeek={handleSeek}
              currentProgress={currentProgress}
              totalDuration={totalDuration}
              timelineEvents={timelineEventsRef.current}
            />
          </div>
          {/* Toggle Legend button */}
          <button
            onClick={() => setIsLegendVisible(!isLegendVisible)}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 flex items-center justify-center shadow-lg hover:shadow-xl transition-all flex-shrink-0"
          >
            <span className="text-sm font-medium">
              Legend {isLegendVisible ? "▼" : "▲"}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}