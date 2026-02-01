"use client"
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Papa from "papaparse";
import { Message, CSVdata, TimelineEvent, ParticipantStats, PasteText, TypingSession, IdlePeriod, TypingDensity } from "@/components/types";
import Prompt from "@/components/prompt";
import GPT from "@/components/gpt";
import SliderComponent from "@/components/sliderComponent";
import Toast from "@/components/toast";
import Legend from "@/components/legend";
import { CodePlay } from "codemirror-record";
import dynamic from 'next/dynamic';
import type { ReplayHandle } from "@/components/replay";
import ParticipantStatsPanel from "@/components/participantStatsPanel";
import Select from "react-select";


const Replay = dynamic(() => import('@/components/replay'), {
  ssr: false,
  loading: () => <div>Loading Replay Editor...</div>,
});

//TODO: Fix P44 having triangles off the seek bar

async function loadCSV() {
  try {
    // Fetch the CSV file (using the fixed version)
    const response = await fetch("/data/replay_data_fixed.csv");
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

interface ParticipantOption {
  value: string;
  label: string;
}

function ReplayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const participantParam = searchParams.get("participant") || "p0";
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
  const pasteTextsRef = useRef<PasteText[]>([]);
  const [typingSessions, setTypingSessions] = useState<TypingSession[]>([]);
  const [idlePeriods, setIdlePeriods] = useState<IdlePeriod[]>([]);
  const [typingDensity, setTypingDensity] = useState<TypingDensity[]>([]);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const lastCopyIndexRef = useRef(0);
  const dataArrayRef = useRef<any[]>([]);
  const [isGraphsVisible, setIsGraphsVisible] = useState(false);
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantOption | null>(null);
  const progressAnimationFrameRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [participantStats, setParticipantStats] = useState<ParticipantStats>({
    po: 0,
    userWords: 0,
    gptWords: 0,
    totalWords: 0,
    selfEfficacy: 0,
    tamOverall: 0,
    csiTotal: 0,
    gptInquiry: 0,
    totalTime: 0,
    userPercent: 0,
  });

  const startProgressTracking = () => {
    // Cancel any existing animation frame
    if (progressAnimationFrameRef.current !== null) {
      cancelAnimationFrame(progressAnimationFrameRef.current);
    }

    const updateProgress = () => {
      if (totalDurationRef.current > 0 && codePlayerRef.current) {
        const currentTimeMs = codePlayerRef.current.getCurrentTime() || 0;
        const currentTimeSec = currentTimeMs / 1000;
        const progress = (currentTimeSec / totalDurationRef.current) * 100;

        // Avoid unnecessary re-renders
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
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    };
    progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  // Load participant list on mount
  useEffect(() => {
    setIsClient(true);

    const loadParticipants = async () => {
      try {
        const response = await fetch("/data/part_info.csv");
        const csvText = await response.text();

        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        const participantOptions: ParticipantOption[] = Array.from({ length: 77 }, (_, i) => {
          const participantData: any = result.data.find((row: any) => parseInt(row.id) === i);

          if (participantData) {
            return {
              value: `p${i}`,
              label: `Participant ${i + 1} (${participantData.Race}, ${participantData.Gender}, ${participantData.Age})`,
            };
          }

          return {
            value: `p${i}`,
            label: `Participant ${i + 1}`,
          };
        });

        setParticipants(participantOptions);
      } catch (error) {
        console.error("Error loading participants:", error);
      }
    };

    loadParticipants();
  }, []);

  // Load participant-specific data when participant changes
  useEffect(() => {
    // Update selected participant in dropdown
    if (participants.length > 0) {
      setSelectedParticipant(participants[essayNum]);
    }

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
            selfEfficacy:
              parseFloat(participantData["Self Efficacy Score"]) || 0,
            tamOverall: parseFloat(participantData["TAM Overall"]) || 0,
            csiTotal: parseFloat(participantData["CSI Total"]) || 0,
            gptInquiry: parseInt(participantData["GPT Inquiry"]) || 0,
            totalTime: parseFloat(participantData["Total Time"]) || 0,
            userPercent: parseFloat(participantData["User Final %"]) || 0,
          });
        }
      } catch (error) {
        console.error("Error loading participant stats:", error);
      }
    };

    loadParticipantStats();

    // Reset playback state
    setMessReplay([]);
    setCurrentProgress(0);
    setShowCopyToast(false);
    lastCopyIndexRef.current = 0;
    messagePlaybackActive.current = false;

    // Stop any existing playback
    if (codePlayerRef.current) {
      codePlayerRef.current.pause();
      codePlayerRef.current = null;
    }

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
  }, [essayNum, participantParam, participants]);

  const getTypingSessionsAndIdlePeriods = (data: any[]) => {
    const IDLE_THRESHOLD = 60; // 1 minute in seconds
    const GAP_THRESHOLD = 20; // 20 seconds gap to split typing sessions

    // Collect editor event timestamps for typing sessions
    const editorEventTimes: number[] = data
      .filter(e => e.op_loc === 'editor')
      .map(e => e.time)
      .sort((a, b) => a - b);

    // Collect ALL event timestamps for idle detection
    const allEventTimes: number[] = data
      .map(e => e.time)
      .sort((a, b) => a - b);

    const sessions: TypingSession[] = [];
    const idles: IdlePeriod[] = [];

    // Calculate typing sessions (editor events only)
    if (editorEventTimes.length > 0) {
      let currentSession = {
        startTime: editorEventTimes[0],
        endTime: editorEventTimes[0],
      };

      for (let i = 1; i < editorEventTimes.length; i++) {
        const timeSinceLastEvent = editorEventTimes[i] - currentSession.endTime;

        if (timeSinceLastEvent <= GAP_THRESHOLD) {
          // Same session - extend end time
          currentSession.endTime = editorEventTimes[i];
        } else {
          // New session
          sessions.push(currentSession);
          currentSession = {
            startTime: editorEventTimes[i],
            endTime: editorEventTimes[i],
          };
        }
      }
      // Add last session
      sessions.push(currentSession);
    }

    // Calculate idle periods (gaps in ALL events > 1 minute)
    if (allEventTimes.length > 0) {
      // Check for idle at the beginning (from time 0 to first event)
      if (allEventTimes[0] > IDLE_THRESHOLD) {
        idles.push({
          start: 0,
          end: allEventTimes[0],
          duration: allEventTimes[0],
        });
      }

      // Check for idle periods between events
      for (let i = 0; i < allEventTimes.length - 1; i++) {
        const gap = allEventTimes[i + 1] - allEventTimes[i];
        if (gap > IDLE_THRESHOLD) {
          idles.push({
            start: allEventTimes[i],
            end: allEventTimes[i + 1],
            duration: gap,
          });
        }
      }
    }

    setTypingSessions(sessions);
    setIdlePeriods(idles);

    // Calculate typing density (for YouTube-style activity graph)
    const NUM_SEGMENTS = 100; // Divide timeline into 100 segments
    const lastEventTime = allEventTimes.length > 0 ? allEventTimes[allEventTimes.length - 1] : 0;
    const segmentDuration = lastEventTime / NUM_SEGMENTS;

    if (segmentDuration > 0) {
      const densityCounts: number[] = new Array(NUM_SEGMENTS).fill(0);

      // Count editor events per segment
      editorEventTimes.forEach(time => {
        const segmentIndex = Math.min(Math.floor(time / segmentDuration), NUM_SEGMENTS - 1);
        densityCounts[segmentIndex]++;
      });

      // Find max for normalization
      const maxCount = Math.max(...densityCounts, 1);

      // Create density data with normalized values
      const density: TypingDensity[] = densityCounts.map((count, index) => ({
        segmentIndex: index,
        count,
        normalized: count / maxCount,
      }));

      setTypingDensity(density);
      console.log("Typing density calculated:", NUM_SEGMENTS, "segments, max count:", maxCount);
    }

    console.log("Typing sessions found:", sessions.length);
    console.log("Idle periods found:", idles.length);
    if (idles.length > 0) {
      console.log("Sample idle periods:", idles.slice(0, 3).map(p =>
        `${Math.floor(p.duration / 60)}m ${Math.floor(p.duration % 60)}s`
      ));
    }
  };

  const getTimelineEvents = (data) => {
    let newTimelineEvents: TimelineEvent[] = [];
    let newPasteTexts: PasteText[] = [];
    for (const element of data) {
      if (element.op_type === "y") {
        newTimelineEvents.push({ time: element.time, type: "copy" });
      }

      if (element.op_type === "p") {
        newTimelineEvents.push({ time: element.time, type: "paste" });
        newPasteTexts.push({
          text: element.add || "",
          destination: element.op_loc as "editor" | "gpt"
        });
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
      const editor = playCodeMirrorRef.current?.getEditor();
      if (editor) {
        // Always start with blank state
        const initialState = ('\n\n\n\n');
        editor.setValue(initialState);
      }

      const newRecordings: string[] = [];
      const newMessages: Message[] = [];
      let messageIndex = 0;

      for (const element of data) {
        switch (element.op_loc) {
          case "editor":
            let record = element.recording_obj;

            if (!record) {
              console.warn(`Skipping empty recording_obj at op_index ${element.op_index}`);
              break;
            }

            try {
              JSON.parse(record);
              newRecordings.push(record);
            } catch (e) {
              console.warn(`Skipping malformed recording_obj at op_index ${element.op_index}:`, e);
              // Continue without this recording
            }
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

      // Get total duration from last event in data (includes all events, not just editor)
      const duration = data.length > 0 ? data[data.length - 1].time : 0;
      totalDurationRef.current = duration;
      setTotalDuration(duration);
      console.log("Total duration:", duration, "seconds (from last event at", duration, "s)");

      // Update participant stats with actual playback duration
      setParticipantStats(prev => ({
        ...prev,
        totalTime: duration
      }));

      // Start message playback
      playMessages(newMessages);

      getTimelineEvents(data);
      getTypingSessionsAndIdlePeriods(data);

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

    const parseRecordingObj = (record: string): string => {
      return record;
    };

    // Helper function specifically for parsing current_editor array
    const parseEditorStateArray = (arrayStr: string): string[] => {
      try {
        return JSON.parse(arrayStr);
      } catch (e) {
        // If parsing fails, return empty array
        console.warn("Failed to parse editor state array, returning empty state");
        return ['', '', '', ''];
      }
    };

    // Helper function to build recording from a specific index
    const buildRecordingFromIndex = (data: any[], startIndex: number): string => {
      const newRecordings: string[] = [];

      for (let i = startIndex; i < data.length; i++) {
        const element = data[i];
        if (element.op_loc === "editor" && element.recording_obj) {
          try {
            const record = parseRecordingObj(element.recording_obj);
            // Validate JSON before adding
            JSON.parse(record);
            newRecordings.push(record);
          } catch (e) {
            console.warn(`Skipping malformed recording_obj at index ${i}:`, e);
            // Continue without this recording
          }
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

    const handleSeek = async (percentage: number) => {
      console.log("Seeking to:", percentage.toFixed(3), "%");

      // Prevent concurrent seeks
      if (isSeekingRef.current) {
        console.log("Already seeking, ignoring this seek request");
        return;
      }

      if (totalDuration === 0 || dataArrayRef.current.length === 0) return;

      const data = dataArrayRef.current;
      const editor = playCodeMirrorRef.current?.getEditor();
      if (!editor) return;

      isSeekingRef.current = true;

      // Cancel any pending resume timeout
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }

      // Calculate target time
      const targetTimeSec = (percentage / 100) * totalDuration;
      const targetTimeMs = targetTimeSec * 1000;

      console.log("Target time:", targetTimeSec.toFixed(2), "seconds");

      // Save current playback state
      const wasPlaying = codePlayerRef.current?.getStatus() === 'PLAY';

      // Stop progress tracking during seek
      if (progressAnimationFrameRef.current !== null) {
        cancelAnimationFrame(progressAnimationFrameRef.current);
        progressAnimationFrameRef.current = null;
      }

      // Pause current playback and destroy old CodePlayer
      if (codePlayerRef.current) {
        codePlayerRef.current.pause();
        // Give it time to fully stop
        await new Promise(resolve => setTimeout(resolve, 200));
        codePlayerRef.current = null;
      }

      // Find the last element BEFORE the target time (not including elements AT target time)
      // This ensures we set the editor to the state before, then replay from target time forward
      let seekIndex = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i].time < targetTimeSec) {
          seekIndex = i;
        } else {
          break;
        }
      }

      console.log(`Seeking to element index ${seekIndex} (before time ${targetTimeSec.toFixed(2)}s)`);

      // Find element with current_editor at or before seekIndex
      let editorStateIndex = seekIndex;
      while (editorStateIndex >= 0 && !data[editorStateIndex].current_editor) {
        editorStateIndex--;
      }

      // Set editor to target state (state before the target time)
      if (editorStateIndex >= 0 && data[editorStateIndex].current_editor) {
        const lines = parseEditorStateArray(data[editorStateIndex].current_editor);
        const stateText = lines.join('\n');
        editor.setValue(stateText);
        console.log(`Set editor to state from index ${editorStateIndex} (time ${data[editorStateIndex]?.time || 0}s)`);
      } else {
        // No editor state found, start from blank
        editor.setValue('\n\n\n\n');
        console.log('No editor state found, starting from blank');
      }

      // Build new recording from seekIndex + 1 (first element at or after target time)
      const recordingStartIndex = seekIndex + 1;
      const newRecording = buildRecordingFromIndex(data, recordingStartIndex);
      console.log(`Built new recording from index ${recordingStartIndex} (time ${data[recordingStartIndex]?.time || 0}s)`);

      // Create new CodePlayer instance
      const newCodePlayer = new CodePlay(editor, {
        autoplay: false,
        speed: speed.current
      });

      newCodePlayer.addOperations(newRecording);
      console.log(`Added operations to new CodePlayer`);

      // Set CodePlayer's internal time to match seek position
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

      // Restart progress tracking to ensure timeline updates continue
      startProgressTracking();

      console.log(`Seek complete to ${targetTimeSec.toFixed(2)}s`);

      // Resume playback after delay if was playing
      if (wasPlaying) {
        resumeTimeoutRef.current = setTimeout(() => {
          setShowResumeToast(true);
          if (codePlayerRef.current) {
            codePlayerRef.current.play();
            console.log("Resumed playback after seek");
          }
          resumeTimeoutRef.current = null;
        }, 200);
      }

      // Release the seek lock after a short delay to prevent rapid successive seeks
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 300);
    };

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleParticipantChange = (option: ParticipantOption | null) => {
    if (option) {
      setSelectedParticipant(option);
      router.push(`/replay?participant=${option.value}`);
    }
  };

  return (
    <>
      {/* Toast notification for copy events */}
      <Toast
        message="Text copied"
        isVisible={showCopyToast}
        onClose={() => setShowCopyToast(false)}
        duration={3000}
      />

      {/* Toast notification for resuming playback */}
      <Toast
        message="Resuming playback"
        isVisible={showResumeToast}
        onClose={() => setShowResumeToast(false)}
        duration={2000}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                Essay Writing Replay
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Interactive playback of essay writing sessions with ChatGPT
              </p>
            </div>
            <div className="w-96">
              {isClient ? (
                <Select
                  options={participants}
                  value={selectedParticipant}
                  onChange={handleParticipantChange}
                  isSearchable={true}
                  className="text-black"
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      padding: "0.25rem",
                      boxShadow: "none",
                      "&:hover": {
                        border: "1px solid #6366f1",
                      },
                    }),
                    menu: (provided) => ({
                      ...provided,
                      zIndex: 9999,
                    }),
                  }}
                />
              ) : (
                <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                  Loading...
                </div>
              )}
            </div>
          </div>
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
            {isGraphsVisible ? "Hide →" : "Participant Stats"}
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
          <ParticipantStatsPanel stats={participantStats} />
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
              typingSessions={typingSessions}
              idlePeriods={idlePeriods}
              typingDensity={typingDensity}
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

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReplayPage />
    </Suspense>
  );
}