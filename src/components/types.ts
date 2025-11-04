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