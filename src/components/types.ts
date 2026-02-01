export type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  time: number;
};

export type TimelineEvent = {
  time: number;
  type: "gpt_inquiry" | "copy" | "paste";
};

export type PasteText = {
  text: string;
  destination: "editor" | "gpt";
};

export type ParticipantStats = {
  po: number;
  userWords: number;
  gptWords: number;
  totalWords: number;
  selfEfficacy: number;
  tamOverall: number;
  csiTotal: number;
  gptInquiry: number;
  totalTime: number;
  userPercent: number;
};

export type TypingSession = {
  startTime: number;  // seconds
  endTime: number;    // seconds
};

export type IdlePeriod = {
  start: number;      // seconds
  end: number;        // seconds
  duration: number;   // seconds
};

export type TypingDensity = {
  segmentIndex: number;
  count: number;       // number of typing events in this segment
  normalized: number;  // 0-1 normalized value for visualization
};

export type CSVdata = Array<{
  idx: number;
  essay_num: number;
  op_index: number;
  time: number;
  op_loc: string;
  op_type: string;
  current_editor: string;
  add: string | null;
  delete: string | null;
  selected_text: string | null;
  recording_obj: string;
}>;