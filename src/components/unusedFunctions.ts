// const handleSeek = (percentage: number) => {
//     console.log("Seeking to:", percentage.toFixed(3), "%");

//     if (!codePlayerRef.current || totalDuration === 0) return;

//     const codePlayer = codePlayerRef.current;

//     // Calculate target time
//     const targetTimeSec = (percentage / 100) * totalDuration;
//     const targetTimeMs = targetTimeSec * 1000;

//     console.log("Target time:", targetTimeSec.toFixed(2), "seconds");

//     // Reset copy event tracking based on seek position
//     const copyEvents = timelineEventsRef.current.filter(e => e.type === 'copy');
//     let newCopyIndex = 0;
//     for (let i = 0; i < copyEvents.length; i++) {
//         if (copyEvents[i].time <= targetTimeSec) {
//             newCopyIndex = i + 1;
//         } else {
//             break;
//         }
//     }
//     lastCopyIndexRef.current = newCopyIndex;

//     // Save current playback state
//     const wasPlaying = codePlayer.getStatus() === 'PLAY';

//     codePlayer.seek(targetTimeMs);

//     // Detect when seeking is complete
//     const checkSeekComplete = () => {
//         const currentTime = codePlayer.getCurrentTime();
//         const timeDiff = Math.abs(currentTime - targetTimeMs);

//         // Restore original playing state
//         if (timeDiff < 10 || codePlayer.getStatus() === "PAUSE") {
//             if (wasPlaying) {
//                 codePlayer.play();
//             }

//             console.log("Seek complete, playing:", wasPlaying);
//         } else {
//             setTimeout(checkSeekComplete, 5);
//         }
//     };

//     // Start checking
//     setTimeout(checkSeekComplete, 5);

//     // Update progress
//     setCurrentProgress(percentage);

//     console.log(`Seeking to ${targetTimeSec.toFixed(2)}s`);
// };

// ========== TIME-BASED PLAYBACK APPROACH (0.1 second intervals) ==========
// // Starts playback from a specific time in seconds
// const startPlaybackFromPosition = async (startTimeSeconds: number): Promise<void> => {
//   const data = dataArrayRef.current;
//   if (!data || data.length === 0) return;

//   playbackIdRef.current += 1;
//   const currentPlaybackId = playbackIdRef.current;
//   shouldCancelPlaybackRef.current = false;

//   let currentTime = Math.floor(startTimeSeconds * 10) / 10;
//   currentPlaybackTimeRef.current = currentTime;

//   let elementIndex = 0;
//   for (let i = 0; i < data.length; i++) {
//     if (data[i].time > currentTime) {
//       elementIndex = i;
//       break;
//     }
//   }

//   let messageIndex = 0;
//   for (let i = 0; i < elementIndex; i++) {
//     if (data[i].op_type === "gpt_inquiry" || data[i].op_type === "gpt_response") {
//       messageIndex++;
//     }
//   }

//   while (currentTime <= totalDurationRef.current) {
//     if (playbackIdRef.current !== currentPlaybackId || shouldCancelPlaybackRef.current) {
//       return;
//     }

//     while (!playing.current) {
//       if (playbackIdRef.current !== currentPlaybackId || shouldCancelPlaybackRef.current) {
//         return;
//       }
//       const paused = sleep(0.01);
//       sleepRef.current = paused;
//       try {
//         await paused.promise;
//       } catch (e) { }
//     }

//     currentPlaybackTimeRef.current = currentTime;

//     while (elementIndex < data.length && Math.floor(data[elementIndex].time * 10) / 10 === currentTime) {
//       const element = data[elementIndex];
//       currentPlaybackTimeRef.current = element.time;

//       switch (element.op_loc) {
//         case "gpt":
//           if (element.op_type === "gpt_inquiry" || element.op_type === "gpt_response") {
//             const newMessage: Message = {
//               id: messageIndex,
//               role: element.op_type === "gpt_inquiry" ? "user" : "assistant",
//               content: element.selected_text || "",
//               time: element.time,
//             };
//             messageIndex += 1;
//             setMessReplay((prevMessages) => [...prevMessages, newMessage]);
//           }
//           break;

//         case "editor":
//           const playCodeMirror = playCodeMirrorRef.current?.getEditor();
//           if (!playCodeMirror) return;

//           let record = element.recording_obj;
//           if (!record) break;

//           // JSON parsing logic...
//           record = record.replace(/: '([\s\S]*?)'/g, (match, content) => {
//             if (match === ": '[") return match;
//             const escaped = content.replace(/"/g, '\\"');
//             return `: '${escaped}'`;
//           });
//           record = record.replace(/\{'/g, '{"');
//           record = record.replace(/':/g, '":');
//           record = record.replace(/, '/g, ', "');
//           record = record.replace(/\['/g, '["');
//           record = record.replace(/'(\})/g, '"$1');
//           record = record.replace(/'(\])/g, '"$1');
//           record = record.replace(/'(,)/g, '"$1');
//           record = record.replace(/: '/g, ': "');
//           record = "[" + record + "]";

//           try {
//             const parsedOps = JSON.parse(record);
//             const adjustedOps = parsedOps.map((op: any) => ({
//               ...op,
//               t: Array.isArray(op.t) ? [0, 100] : 0
//             }));

//             const codePlayer = new CodePlay(playCodeMirror, {
//               autoplay: true,
//               minDelay: 0
//             });
//             codePlayer.addOperations(JSON.stringify(adjustedOps));
//           } catch (e) {
//             console.error("CodePlay failed:", e);
//           }
//           break;
//       }
//       elementIndex++;
//     }

//     const waitAction = sleep(0.1 / speed.current); // 0.1 second intervals
//     sleepRef.current = waitAction;
//     try {
//       await waitAction.promise;
//     } catch (e) { }

//     currentTime = Math.round((currentTime + 0.1) * 10) / 10;
//   }
// };




// const handleLoadArrays_TimeBased = async (): Promise<void> => {
//   const allData = (await loadCSV()) as CSVdata;
//   if (allData) {
//     const data = allData.filter((row: any) => row.essay_num === essayNum);
//     if (data.length === 0) return;

//     dataArrayRef.current = data;

//     // Set initial editor state
//     if (data[0] && data[0].current_editor) {
//       try {
//         let editorState = data[0].current_editor.replace(/'/g, '"');
//         const initialLines = JSON.parse(editorState);
//         const initialState = ('\n\n\n\n');
//         const editor = playCodeMirrorRef.current?.getEditor();
//         if (editor) {
//           editor.setValue(initialState);
//         }
//       } catch (e) {
//         console.error("Failed to parse initial editor state:", e);
//       }
//     }

//     // Build timeline events
//     const newTimelineEvents: TimelineEvent[] = [];
//     const newPasteTexts: string[] = [];

//     for (const element of data) {
//       if (element.op_type === 'y') {
//         newTimelineEvents.push({ time: element.time, type: 'copy' });
//       }
//       if (element.op_type === 'p') {
//         newTimelineEvents.push({ time: element.time, type: 'paste' });
//         newPasteTexts.push(element.add || "");
//       }
//       if (element.op_type === "gpt_inquiry") {
//         newTimelineEvents.push({ time: element.time, type: 'gpt_inquiry' });
//       }
//     }

//     newTimelineEvents.sort((a, b) => a.time - b.time);
//     timelineEventsRef.current = newTimelineEvents;
//     pasteTextsRef.current = newPasteTexts;

//     const duration = data.length > 0 ? data[data.length - 1].time : 0;
//     totalDurationRef.current = duration;
//     setTotalDuration(duration);

//     startProgressTracking();
//     startPlaybackFromPosition(0);
//   }
// };

// const startProgressTracking_TimeBased = () => {
//   const updateProgress = () => {
//     if (totalDurationRef.current > 0) {
//       const currentTimeSec = currentPlaybackTimeRef.current;
//       const progress = (currentTimeSec / totalDurationRef.current) * 100;

//       setCurrentProgress(prev => {
//         const newProgress = Math.min(progress, 100);
//         if (Math.abs(newProgress - prev) > 0.01) {
//           return newProgress;
//         }
//         return prev;
//       });

//       const copyEvents = timelineEventsRef.current.filter(e => e.type === 'copy');
//       for (let i = lastCopyIndexRef.current; i < copyEvents.length; i++) {
//         if (copyEvents[i].time <= currentTimeSec) {
//           setShowCopyToast(true);
//           lastCopyIndexRef.current = i + 1;
//         } else {
//           break;
//         }
//       }
//     }
//     requestAnimationFrame(updateProgress);
//   };
//   requestAnimationFrame(updateProgress);
// };

// ========== TIME-BASED PLAYBACK APPROACH (1 second intervals, used before 0.1 second) ==========
// // Refs needed:
// // const sleepRef = useRef<{ cancel: () => void } | null>(null);
// // const dataArrayRef = useRef<any[]>([]);
// // const playbackIdRef = useRef(0);
// // const shouldCancelPlaybackRef = useRef(false);
// // const currentPlaybackTimeRef = useRef(0);

// const startProgressTracking_1Second = () => {
//   const updateProgress = () => {
//     if (totalDurationRef.current > 0) {
//       const currentTimeSec = currentPlaybackTimeRef.current;
//       const progress = (currentTimeSec / totalDurationRef.current) * 100;
//       setCurrentProgress(prev => {
//         const newProgress = Math.min(progress, 100);
//         if (Math.abs(newProgress - prev) > 0.01) {
//           return newProgress;
//         }
//         return prev;
//       });
//       const copyEvents = timelineEventsRef.current.filter(e => e.type === 'copy');
//       for (let i = lastCopyIndexRef.current; i < copyEvents.length; i++) {
//         if (copyEvents[i].time <= currentTimeSec) {
//           setShowCopyToast(true);
//           lastCopyIndexRef.current = i + 1;
//         } else {
//           break;
//         }
//       }
//     }
//     requestAnimationFrame(updateProgress);
//   };
//   requestAnimationFrame(updateProgress);
// };

// const handleSpeedChange_1Second = (newSpeed) => {
//   console.log("Speed changed to:", newSpeed);
//   speed.current = newSpeed;
//   if (sleepRef.current) {
//     sleepRef.current.cancel();
//   }
// };

// const handlePlayChange_1Second = (isPlaying) => {
//   console.log("Play state changed to:", isPlaying);
//   playing.current = isPlaying;
// };

// const handleSeek_1Second = (percentage: number) => {
//   if (totalDuration === 0 || dataArrayRef.current.length === 0) return;
//   const targetTimeSec = (percentage / 100) * totalDuration;
//   const wasPlaying = playing.current;
//   playing.current = false;
//   shouldCancelPlaybackRef.current = true;
//   if (sleepRef.current) {
//     sleepRef.current.cancel();
//   }
//   const data = dataArrayRef.current;
//   let seekIndex = 0;
//   for (let i = 0; i < data.length; i++) {
//     if (data[i].time <= targetTimeSec) {
//       seekIndex = i;
//     } else {
//       break;
//     }
//   }
//   const editor = playCodeMirrorRef.current?.getEditor();
//   if (editor) {
//     let editorStateIndex = seekIndex;
//     while (editorStateIndex >= 0 && !data[editorStateIndex].current_editor) {
//       editorStateIndex--;
//     }
//     if (editorStateIndex >= 0 && data[editorStateIndex].current_editor) {
//       try {
//         let editorState = data[editorStateIndex].current_editor;
//         editorState = editorState.replace(/\['/g, '["');
//         editorState = editorState.replace(/'\]/g, '"]');
//         editorState = editorState.replace(/', '/g, '", "');
//         editorState = editorState.replace(/", '/g, '", "');
//         editorState = editorState.replace(/'(,)/g, '"$1');
//         editorState = editorState.replace(/: '/g, ': "');
//         const lines = JSON.parse(editorState);
//         const stateText = lines.join('\n');
//         editor.setValue(stateText);
//       } catch (e) {
//         console.error("Failed to parse editor state at seek position:", e);
//       }
//     }
//   }
//   const messagesToShow: Message[] = [];
//   let msgIndex = 0;
//   for (let i = 0; i <= seekIndex; i++) {
//     const element = data[i];
//     if (element.op_type === "gpt_inquiry" || element.op_type === "gpt_response") {
//       messagesToShow.push({
//         id: msgIndex,
//         role: element.op_type === "gpt_inquiry" ? "user" : "assistant",
//         content: element.selected_text || "",
//         time: element.time,
//       });
//       msgIndex++;
//     }
//   }
//   setMessReplay(messagesToShow);
//   const copyEvents = timelineEventsRef.current.filter(e => e.type === 'copy');
//   let newCopyIndex = 0;
//   for (let i = 0; i < copyEvents.length; i++) {
//     if (copyEvents[i].time <= targetTimeSec) {
//       newCopyIndex = i + 1;
//     } else {
//       break;
//     }
//   }
//   lastCopyIndexRef.current = newCopyIndex;
//   setCurrentProgress(percentage);
//   currentPlaybackTimeRef.current = targetTimeSec;
//   setTimeout(() => {
//     startPlaybackFromPosition_1Second(targetTimeSec);
//     setTimeout(() => {
//       if (wasPlaying) {
//         playing.current = true;
//       }
//     }, 500);
//   }, 100);
// };

// const startPlaybackFromPosition_1Second = async (startTimeSeconds: number): Promise<void> => {
//   const data = dataArrayRef.current;
//   if (!data || data.length === 0) return;
//   playbackIdRef.current += 1;
//   const currentPlaybackId = playbackIdRef.current;
//   shouldCancelPlaybackRef.current = false;
//   let currentTime = Math.floor(startTimeSeconds);
//   currentPlaybackTimeRef.current = currentTime;
//   let elementIndex = 0;
//   for (let i = 0; i < data.length; i++) {
//     if (data[i].time > currentTime) {
//       elementIndex = i;
//       break;
//     }
//   }
//   let messageIndex = 0;
//   for (let i = 0; i < elementIndex; i++) {
//     if (data[i].op_type === "gpt_inquiry" || data[i].op_type === "gpt_response") {
//       messageIndex++;
//     }
//   }
//   while (currentTime <= totalDurationRef.current) {
//     if (playbackIdRef.current !== currentPlaybackId || shouldCancelPlaybackRef.current) {
//       return;
//     }
//     while (!playing.current) {
//       if (playbackIdRef.current !== currentPlaybackId || shouldCancelPlaybackRef.current) {
//         return;
//       }
//       const paused = sleep(0.01);
//       sleepRef.current = paused;
//       try {
//         await paused.promise;
//       } catch (e) { }
//     }
//     currentPlaybackTimeRef.current = currentTime;
//     while (elementIndex < data.length && Math.floor(data[elementIndex].time) === currentTime) {
//       const element = data[elementIndex];
//       currentPlaybackTimeRef.current = element.time;
//       switch (element.op_loc) {
//         case "gpt":
//           if (element.op_type === "gpt_inquiry" || element.op_type === "gpt_response") {
//             const newMessage: Message = {
//               id: messageIndex,
//               role: element.op_type === "gpt_inquiry" ? "user" : "assistant",
//               content: element.selected_text || "",
//               time: element.time,
//             };
//             messageIndex += 1;
//             setMessReplay((prevMessages) => [...prevMessages, newMessage]);
//           }
//           break;
//         case "editor":
//           const playCodeMirror = playCodeMirrorRef.current?.getEditor();
//           if (!playCodeMirror) return;
//           let record = element.recording_obj;
//           if (!record) break;
//           record = record.replace(/: '([\s\S]*?)'/g, (match, content) => {
//             if (match === ": '[") return match;
//             const escaped = content.replace(/"/g, '\\"');
//             return `: '${escaped}'`;
//           });
//           record = record.replace(/\{'/g, '{"');
//           record = record.replace(/':/g, '":');
//           record = record.replace(/, '/g, ', "');
//           record = record.replace(/\['/g, '["');
//           record = record.replace(/'(\})/g, '"$1');
//           record = record.replace(/'(\])/g, '"$1');
//           record = record.replace(/'(,)/g, '"$1');
//           record = record.replace(/: '/g, ': "');
//           record = "[" + record + "]";
//           try {
//             const parsedOps = JSON.parse(record);
//             const adjustedOps = parsedOps.map((op: any) => {
//               let newT = Array.isArray(op.t) ? [0, 100] : 0;
//               return { ...op, t: newT };
//             });
//             const adjustedRecord = JSON.stringify(adjustedOps);
//             const codePlayer = new CodePlay(playCodeMirror, {
//               autoplay: true,
//               minDelay: 0
//             });
//             codePlayer.addOperations(adjustedRecord);
//           } catch (e) {
//             console.error("CodePlay failed:", e);
//           }
//           break;
//       }
//       elementIndex++;
//     }
//     const waitAction = sleep(1 / speed.current);
//     sleepRef.current = waitAction;
//     try {
//       await waitAction.promise;
//     } catch (e) { }
//     currentTime++;
//   }
// };

// const handleLoadArrays_1Second = async (): Promise<void> => {
//   const allData = (await loadCSV()) as CSVdata;
//   if (allData) {
//     const data = allData.filter((row: any) => row.essay_num === essayNum);
//     if (data.length === 0) return;
//     dataArrayRef.current = data;
//     if (data[0] && data[0].current_editor) {
//       try {
//         let editorState = data[0].current_editor;
//         editorState = editorState.replace(/'/g, '"');
//         const initialLines = JSON.parse(editorState);
//         const initialState = ('\n\n\n\n');
//         const editor = playCodeMirrorRef.current?.getEditor();
//         if (editor) {
//           editor.setValue(initialState);
//         }
//       } catch (e) {
//         console.error("Failed to parse initial editor state:", e);
//       }
//     }
//     const newTimelineEvents: TimelineEvent[] = [];
//     const newPasteTexts: string[] = [];
//     for (const element of data) {
//       if (element.op_type === 'y') {
//         newTimelineEvents.push({ time: element.time, type: 'copy' });
//       }
//       if (element.op_type === 'p') {
//         newTimelineEvents.push({ time: element.time, type: 'paste' });
//         newPasteTexts.push(element.add || "");
//       }
//       if (element.op_type === "gpt_inquiry") {
//         newTimelineEvents.push({ time: element.time, type: 'gpt_inquiry' });
//       }
//     }
//     newTimelineEvents.sort((a, b) => a.time - b.time);
//     timelineEventsRef.current = newTimelineEvents;
//     pasteTextsRef.current = newPasteTexts;
//     const duration = data.length > 0 ? data[data.length - 1].time : 0;
//     totalDurationRef.current = duration;
//     setTotalDuration(duration);
//     startProgressTracking_1Second();
//     startPlaybackFromPosition_1Second(0);
//   }
// };