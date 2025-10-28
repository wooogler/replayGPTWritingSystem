"use client"
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { Message, CSVdata, TimelineEvent } from "@/components/types";
import Prompt from "@/components/prompt";
import GPT from "@/components/gpt";
import SliderComponent from "@/components/sliderComponent";
import Toast from "@/components/toast";
import { CodePlay } from "codemirror-record";
import dynamic from 'next/dynamic';
import type { ReplayHandle } from "@/components/replay";


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


export default function Home() {
  const searchParams = useSearchParams();
  const participantParam = searchParams.get('participant') || 'p1';
  const essayNum = parseInt(participantParam.replace('p', ''));

  const [messReplay, setMessReplay] = useState<Message[]>([]);
  const [isPromptVisible, setisPromptVisible] = useState(false);
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

  const startProgressTracking = () => {
    const updateProgress = () => {
      if (codePlayerRef.current && totalDurationRef.current > 0) {
        const currentTimeMs = codePlayerRef.current.getCurrentTime();
        const currentTimeSec = currentTimeMs / 1000;
        const progress = (currentTimeSec / totalDurationRef.current) * 100;

        // Functional updating to avoid unnecessary re-renders
        setCurrentProgress(prev => {
          const newProgress = Math.min(progress, 100);
          if (Math.abs(newProgress - prev) > 0.01) {
            return newProgress;
          }
          return prev;
        });

        // Check for copy events and show toast
        const copyEvents = timelineEventsRef.current.filter(e => e.type === 'copy');
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

    // Set initial editor state from first row
    if (data[0] && data[0].current_editor) {
      try {
        // Convert single quotes to double quotes for valid JSON
        let editorState = data[0].current_editor;
        editorState = editorState.replace(/'/g, '"');

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
    const newTimelineEvents: TimelineEvent[] = [];
    const newPasteTexts: string[] = [];
    let messageIndex = 0;

    for(const element of data) {
      switch(element.op_loc) {
        case "editor":
          // Track copy and paste events for timeline rendering
          if (element.op_type === 'y') {
            newTimelineEvents.push({ time: element.time, type: 'copy' });
          }

          if (element.op_type === 'p') {
            newTimelineEvents.push({ time: element.time, type: 'paste' });
            newPasteTexts.push(element.add || "");
          }

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

            // Add GPT inquiry events to timeline
            if (element.op_type === "gpt_inquiry") {
              newTimelineEvents.push({ time: element.time, type: 'gpt_inquiry' });
            }

            console.log(`Message ${messageIndex}: time=${element.time}, content=${element.selected_text?.substring(0, 50)}...`);
          }
          break;
      }

    }

    console.log("Total messages found:", newMessages.length);

    // Store all messages for seek functionality
    allMessagesRef.current = newMessages;

    // Sort timeline events by time and store
    newTimelineEvents.sort((a, b) => a.time - b.time);
    timelineEventsRef.current = newTimelineEvents;

    // Store paste texts
    pasteTextsRef.current = newPasteTexts;

    console.log("Timeline events found:", newTimelineEvents.length);
    console.log("  - GPT inquiries:", newTimelineEvents.filter(e => e.type === 'gpt_inquiry').length);
    console.log("  - Copy events:", newTimelineEvents.filter(e => e.type === 'copy').length);
    console.log("  - Paste events:", newTimelineEvents.filter(e => e.type === 'paste').length);

    const combinedRecording = "[" + newRecordings.join(", ") + "]";
    setRecording(combinedRecording);

    // try {
    //   JSON.parse(combinedRecording);
    // } catch (e) {
    //   console.error("Invalid JSON generated:", e);
    //   return;
    // }

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

    if (!codePlayerRef.current || totalDuration === 0) return;

    const codePlayer = codePlayerRef.current;

    // Calculate target time
    const targetTimeSec = (percentage / 100) * totalDuration;
    const targetTimeMs = targetTimeSec * 1000;

    console.log("Target time:", targetTimeSec.toFixed(2), "seconds");

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

    // Save current playback state
    const wasPlaying = codePlayer.getStatus() === 'PLAY';

    codePlayer.seek(targetTimeMs);

    // Detect when seeking is complete
    const checkSeekComplete = () => {
      const currentTime = codePlayer.getCurrentTime();
      const timeDiff = Math.abs(currentTime - targetTimeMs);

      // Restore original playing state
      if (timeDiff < 10 || codePlayer.getStatus() === "PAUSE") {
        if (wasPlaying) {
          codePlayer.play();
        }

        console.log("Seek complete, playing:", wasPlaying);
      } else {
        setTimeout(checkSeekComplete, 5);
      }
    };

    // Start checking
    setTimeout(checkSeekComplete, 5);

    // Update progress
    setCurrentProgress(percentage);

    console.log(`Seeking to ${targetTimeSec.toFixed(2)}s`);
  };

useEffect(() => {
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
      console.error("Editor failed to initialize after", maxAttempts, "attempts");
      clearInterval(checkEditor);
    }
  }, 200);

  return () => clearInterval(checkEditor);
}, []);


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
  <div className={`transition-all duration-300 flex-shrink-0 ${
    isPromptVisible ? 'w-[25%]' : 'w-0'
  }`}>
    <div className={`h-full flex items-start overflow-hidden ${
      isPromptVisible ? 'opacity-100' : 'opacity-0'
    } transition-opacity duration-300`}>
      <div className="ml-4 border rounded-xl border-gray-200 bg-white p-4 w-full h-full flex flex-col overflow-auto shadow-lg">
        <Prompt />
      </div>
    </div>
  </div>

  {/* Toggle Prompt button */}
  <button
    onClick={() => setisPromptVisible(!isPromptVisible)}
    className={`bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 h-fit flex items-center justify-center shadow-xl hover:shadow-2xl transition-all z-50 flex-shrink-0 self-start ${
      isPromptVisible ? 'mx-2' : 'mr-2'
    }`}
  >
    <span className="text-sm font-medium">{isPromptVisible ? '← Hide' : 'Prompt →'}</span>
  </button>

  {/* Main content area */}
<div className="flex-1 flex flex-col">
  <div id="frames" className={`flex justify-center h-full gap-4 transition-all duration-300 ${
    isPromptVisible ? 'w-full' : 'w-full'
  }`}>
    <div className={`border rounded-xl shadow-xl border-gray-200 p-5 transition-all duration-300 bg-white ${
      isPromptVisible ? 'w-[55%]' : 'w-1/2'
    } flex flex-col`}>
      <Replay ref={playCodeMirrorRef} />
    </div>
    <div className={`border rounded-xl shadow-xl border-gray-200 p-5 bg-white ${
      isPromptVisible ? 'w-[45%]' : 'w-1/2'
    } flex flex-col`}>
      <GPT messages={messReplay} pasteTexts={pasteTextsRef.current}/>
    </div>
  </div>
</div>
</main>

  {/* Controls footer */}
  <div className="flex w-full justify-center fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-3 px-6">
    <div className="w-full">
      <SliderComponent
        onSpeedChange={handleSpeedChange}
        onPlayChange={handlePlayChange}
        onSeek={handleSeek}
        currentProgress={currentProgress}
        totalDuration={totalDuration}
        timelineEvents={timelineEventsRef.current}
      />
    </div>
  </div>
  </>
  );
}

// const handleLoadArrays = async (): Promise<void> => {
//   const data = (await loadCSV()) as csv_data;
//   if (data) {
//     let waitTime = Number(data[0][3]) / speed.current;
//     console.log(data[0]);
//     for (const element of data) {
//       while (!playing.current) {
//         const paused = sleep(0.01);
//         sleepRef.current = paused;
//         try {
//           await paused.promise;
//         } catch (e) {
          
//         }
//         console.log("Paused, waiting to resume...");
//       }
      
      
//       let waiting = false;
//       while (!waiting) {
//         let tempTime = ((Number(element[3])) / Number(speed.current));
//         let calcTime = tempTime - waitTime;
//         waitTime = tempTime;
//         console.log("Waiting", calcTime,"seconds");

//         const action = sleep(calcTime);
//         sleepRef.current = action;
//         try {
//           await action.promise;
//           waiting = true;
//         } catch (e) {
//           console.log("Wait cancelled, recalculating wait time...");

//           // If paused, wait until resumed before retrying
//           while (!playing.current) {
//             const pauseSleep = sleep(0.01);
//             sleepRef.current = pauseSleep;
//             try {
//               await pauseSleep.promise;
//             } catch (e) {
//               // Pause sleep cancelled, continue checking
//             }
//             console.log("Paused, waiting to resume...");
//               }
//             }
//       // console.log("Processing element:", element);
      
//       switch (element[4]) {
//         case "gpt":
//           if(element[5] === "gpt_inquiry" || element[5] === "gpt_response"){
//             const newMessage: Message = {
//             id: mess_index,
//             role: element[5] === "gpt_inquiry" ? "user" : "assistant",
//             content: element[9],
//           };
//           mess_index += 1;

//           setMessages((prevMessages) => [...prevMessages, newMessage]);
//           break;
//           }
//      case "editor":
//   const playCodeMirror = playCodeMirrorRef.current?.getEditor();
//   if(!playCodeMirror) {
//     console.error("No CodeMirror instance");
//     return;
//   }
  
//   console.log("Raw element[11]:", element[11]);
  
//   // Smart approach: Only replace single quotes that are structural (keys, brackets)
//   // not the ones inside string values
//   let record = element[11];
  
//   // Replace single quotes around keys: {'key' -> {"key"
//   record = record.replace(/\{'/g, '{"');
//   record = record.replace(/':/g, '":');
//   record = record.replace(/, '/g, ', "');
//   record = record.replace(/\['/g, '["');
  
//   // Replace single quotes around values that are followed by }, ], or ,
//   record = record.replace(/'(\})/g, '"$1');
//   record = record.replace(/'(\])/g, '"$1');
//   record = record.replace(/'(,)/g, '"$1');
  
//   // Replace opening quotes for string values after :
//   record = record.replace(/: '/g, ': "');
  
//   // Wrap in array brackets
//   record = "[" + record + "]";
  
//   console.log("Constructed record:", record);

//   try {
//     const parsedOps = JSON.parse(record);
//     console.log("Original operations:", parsedOps);
    
//     const adjustedOps = parsedOps.map(op => {
//       let newT;
//       if (Array.isArray(op.t)) {
//         newT = [0, 100];
//       } else {
//         newT = 0;
//       }
      
//       return {
//         ...op,
//         t: newT
//       };
//     });
    
//     const adjustedRecord = JSON.stringify(adjustedOps);
    
//     const codePlayer = new CodePlay(playCodeMirror, { 
//       autoplay: true,
//       minDelay: 0
//     });
    
//     codePlayer.addOperations(adjustedRecord);
//     console.log("Operations added");
    
//   } catch (e) {
//     console.error("CodePlay failed:", e);
//     console.error("Failed record:", record);
//   }
//   break;
//         }
//       }
//     }
//   }};