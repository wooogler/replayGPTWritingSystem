"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Select from "react-select";
import { FaPlay, FaPause } from "react-icons/fa6";
import { FaTachometerAlt, FaFastBackward, FaFastForward } from "react-icons/fa";
import { TimelineEvent, TypingSession, IdlePeriod, TypingDensity, WordCountData } from "./types";
import { FaChartLine } from "react-icons/fa";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

const speeds = [
  { value: 0.5, label: ".5x" },
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 5, label: "5x" },
  { value: 10, label: "10x" },
];

interface SliderProps {
  onSpeedChange: (newSpeed: number) => void;
  onPlayChange: (isPlaying: boolean) => void;
  onSeek: (percentage: number) => void;
  onGraphToggle?: (isExpanded: boolean) => void;
  currentProgress?: number;
  totalDuration?: number; // seconds
  timelineEvents?: TimelineEvent[];
  typingSessions?: TypingSession[];
  idlePeriods?: IdlePeriod[];
  typingDensity?: TypingDensity[];
  wordCountData?: WordCountData[];
}

export default function SliderComponent({
  onSpeedChange,
  onPlayChange,
  onSeek,
  onGraphToggle,
  currentProgress = 0,
  totalDuration = 0,
  timelineEvents = [],
  typingSessions = [],
  idlePeriods = [],
  wordCountData = []
}: SliderProps) {
  const [isClient, setIsClient] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState(speeds[2]);
  const [hoveredEvent, setHoveredEvent] = useState<{label: string, time: string, x: number, y: number} | null>(null);
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);
  const [seekBarPosition, setSeekBarPosition] = useState({ left: 0, width: 0 });
  const seekBarRef = useRef<HTMLDivElement>(null);
  const seekBarContainerRef = useRef<HTMLDivElement>(null);

  // Calculate max word count for graph scaling
  const maxWordCount = wordCountData.length > 0
    ? Math.max(...wordCountData.map(d => d.wordCount))
    : 0;

  // Convert data for Recharts with interpolated points for continuous tooltip
  const chartData = (() => {
    if (wordCountData.length < 2 || totalDuration === 0) {
      return wordCountData.map(d => ({
        time: d.time,
        percentage: 0,
        wordCount: d.wordCount,
        timeFormatted: `${Math.floor(d.time / 60)}:${Math.floor(d.time % 60).toString().padStart(2, '0')}`
      }));
    }

    // Create interpolated data points every 5 seconds for continuous tooltip
    const interpolatedData: Array<{time: number, percentage: number, wordCount: number, timeFormatted: string}> = [];
    const interval = 5; // seconds

    for (let t = 0; t <= totalDuration; t += interval) {
      // Find surrounding data points
      let wordCount = 0;
      for (let i = 0; i < wordCountData.length - 1; i++) {
        if (wordCountData[i].time <= t && wordCountData[i + 1].time >= t) {
          // Linear interpolation
          const ratio = wordCountData[i + 1].time === wordCountData[i].time
            ? 0
            : (t - wordCountData[i].time) / (wordCountData[i + 1].time - wordCountData[i].time);
          wordCount = Math.round(wordCountData[i].wordCount + ratio * (wordCountData[i + 1].wordCount - wordCountData[i].wordCount));
          break;
        } else if (t >= wordCountData[wordCountData.length - 1].time) {
          wordCount = wordCountData[wordCountData.length - 1].wordCount;
          break;
        }
      }

      interpolatedData.push({
        time: t,
        percentage: (t / totalDuration) * 100,
        wordCount,
        timeFormatted: `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`
      });
    }

    // Ensure we have the last point
    if (interpolatedData[interpolatedData.length - 1]?.time !== totalDuration) {
      const lastData = wordCountData[wordCountData.length - 1];
      interpolatedData.push({
        time: totalDuration,
        percentage: 100,
        wordCount: lastData.wordCount,
        timeFormatted: `${Math.floor(totalDuration / 60)}:${Math.floor(totalDuration % 60).toString().padStart(2, '0')}`
      });
    }

    return interpolatedData;
  })();

  // Measure seek bar position
  const updateSeekBarPosition = useCallback(() => {
    if (seekBarContainerRef.current) {
      const containerRect = seekBarContainerRef.current.getBoundingClientRect();
      const parentRect = seekBarContainerRef.current.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setSeekBarPosition({
          left: containerRect.left - parentRect.left,
          width: containerRect.width
        });
      }
    }
  }, []);

  useEffect(() => {
    updateSeekBarPosition();
    window.addEventListener('resize', updateSeekBarPosition);
    return () => window.removeEventListener('resize', updateSeekBarPosition);
  }, [updateSeekBarPosition]);

  // Update position when graph toggles
  useEffect(() => {
    setTimeout(updateSeekBarPosition, 100);
  }, [isGraphExpanded, updateSeekBarPosition]);

  // Ensure speed is reset to 1x on mount
  useEffect(() => {
    setSelectedSpeed(speeds[1]);
    onSpeedChange(1);
  }, []);

  const handleSpeedChange = (selectedOption: any) => {
    setSelectedSpeed(selectedOption);
    onSpeedChange(selectedOption.value);
  }

  const handlePlayPause = () => {
    const newPlayingState = !playing;
    setPlaying(newPlayingState);
    onPlayChange(newPlayingState);
  };

  const handleJumpToStart = () => {
    onSeek(0);
  };

  const handleJumpToEnd = () => {
    onSeek(100);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSeek = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    onSeek(percentage);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    const handleMouseMove = (e: MouseEvent) => {
      const seekBar = document.querySelector('.seek-bar');
      if (!seekBar) return;

      const rect = seekBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clampedX = Math.max(0, Math.min(clickX, rect.width));
      const percentage = (clampedX / rect.width) * 100;
      onSeek(percentage);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };


  // Handle direct click on chart area for precise seeking
  const handleChartAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, percentage)));
  };

  // Interpolate word count for any given percentage
  const interpolateWordCount = (percentage: number): number => {
    if (chartData.length < 2) return 0;

    // Find the two data points that surround this percentage
    let lower = chartData[0];
    let upper = chartData[chartData.length - 1];

    for (let i = 0; i < chartData.length - 1; i++) {
      if (chartData[i].percentage <= percentage && chartData[i + 1].percentage >= percentage) {
        lower = chartData[i];
        upper = chartData[i + 1];
        break;
      }
    }

    // Linear interpolation
    if (upper.percentage === lower.percentage) return lower.wordCount;
    const ratio = (percentage - lower.percentage) / (upper.percentage - lower.percentage);
    return Math.round(lower.wordCount + ratio * (upper.wordCount - lower.wordCount));
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentTime = (currentProgress / 100) * totalDuration;
  const currentTimeFormatted = formatTime(currentTime);
  const totalTimeFormatted = formatTime(totalDuration);

  // Custom tooltip for recharts - with interpolation
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = payload[0].payload.percentage;
      const wordCount = interpolateWordCount(percentage);
      const timeInSeconds = (percentage / 100) * totalDuration;
      const timeStr = `${Math.floor(timeInSeconds / 60)}:${Math.floor(timeInSeconds % 60).toString().padStart(2, '0')}`;

      return (
        <div className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
          <div className="font-semibold">{wordCount} words</div>
          <div className="text-gray-300 text-xs">at {timeStr}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Word count graph area (appears when expanded) */}
      {wordCountData.length > 0 && (
        <div 
          className={`w-full relative overflow-hidden transition-all duration-300 ${
            isGraphExpanded ? 'h-[90px]' : 'h-0'
          }`}
        >
          <div
            className={`absolute h-[90px] cursor-pointer outline-none transition-transform duration-300 ${
              isGraphExpanded ? 'translate-y-0' : 'translate-y-full'
            }`}
            style={{
              left: `${seekBarPosition.left}px`,
              width: `${seekBarPosition.width}px`
            }}
            onClick={handleChartAreaClick}
            tabIndex={-1}
          >
            {/* Y-axis label */}
            <div className="absolute -left-11 top-0 bottom-0 flex flex-col justify-between text-[11px] text-gray-600 font-medium w-10 text-right pr-1">
              <span>{maxWordCount}</span>
              <span>{Math.round(maxWordCount / 2)}</span>
              <span>0</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <defs>
                  <linearGradient id="wordCountGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="percentage"
                  type="number"
                  domain={[0, 100]}
                  hide
                />
                <YAxis
                  domain={[0, maxWordCount]}
                  hide
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <ReferenceLine
                  x={currentProgress}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="wordCount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#wordCountGradient)"
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Controls row */}
      <div className="flex gap-1 w-full items-center pl-24">
        <button
          id="play-pause"
          onClick={handlePlayPause}
          className="px-2 flex items-center justify-center"
          style={{ width: '40px', height: '32px' }}
        >
          {playing ? <FaPause size={22} /> : <FaPlay size={20} />}
        </button>
        <button
          id="jump-to-start"
          onClick={handleJumpToStart}
          className="px-2"
          title="Jump to Start"
        >
          <FaFastBackward size={19} />
        </button>
        <button
          id="jump-to-end"
          onClick={handleJumpToEnd}
          className="px-2"
          title="Jump to End"
        >
          <FaFastForward size={19} />
        </button>
        <span suppressHydrationWarning={true}>
          {isClient ? (
            <Select
              id="speed"
              className="pr-1"
              options={speeds}
              menuPlacement="auto"
              value={selectedSpeed}
              onChange={handleSpeedChange}
              isSearchable={false}
              components={{
                IndicatorSeparator: () => null,
                DropdownIndicator: () => null,
              }}
              styles={{
                control: (provided) => ({
                  ...provided,
                  border: "none",
                  boxShadow: "none",
                  minHeight: 0,
                  backgroundColor: "transparent",
                }),
                valueContainer: (provided) => ({
                  ...provided,
                  paddingLeft: 5,
                  paddingRight: 5,
                }),
                menu: (provided) => ({
                  ...provided,
                  minWidth: "45px",
                }),
                option: (provided) => ({
                  ...provided,
                  textAlign: "center",
                  paddingLeft: 4,
                  paddingRight: 4,
                }),
              }}
              formatOptionLabel={(option, { context }) => {
                if (context === "value") {
                  return <FaTachometerAlt size={21} />;
                }
                return option.label;
              }}
            />
          ) : (
            <div>Loading...</div>
          )}
        </span>
        {/* Seek bar */}
        <div ref={seekBarContainerRef} className="seek-bar-container flex-grow flex items-center">
          <div
            ref={seekBarRef}
            onClick={handleSeek}
            onMouseDown={handleMouseDown}
            className="seek-bar h-2 rounded cursor-pointer w-full relative bg-gray-400"
          >
            {/* Activity segments container */}
            <div className="absolute inset-0 rounded overflow-hidden">
              {/* Typing sessions (blue) */}
              {typingSessions.map((session, index) => {
                const startPercent = totalDuration > 0 ? (session.startTime / totalDuration) * 100 : 0;
                const endPercent = totalDuration > 0 ? (session.endTime / totalDuration) * 100 : 0;
                const width = endPercent - startPercent;
                return (
                  <div
                    key={`typing-${index}`}
                    className="absolute h-full bg-blue-500"
                    style={{
                      left: `${startPercent}%`,
                      width: `${Math.max(width, 0.5)}%`,
                    }}
                  />
                );
              })}

              {/* Idle periods (black) */}
              {idlePeriods.map((idle, index) => {
                const startPercent = totalDuration > 0 ? (idle.start / totalDuration) * 100 : 0;
                const endPercent = totalDuration > 0 ? (idle.end / totalDuration) * 100 : 0;
                const width = endPercent - startPercent;
                return (
                  <div
                    key={`idle-${index}`}
                    className="absolute h-full bg-black"
                    style={{
                      left: `${startPercent}%`,
                      width: `${Math.max(width, 0.5)}%`,
                    }}
                  />
                );
              })}

              {/* Progress overlay */}
              <div
                className="absolute h-full bg-white/40"
                style={{
                  width: `${currentProgress}%`,
                  transition: 'width 0.1s ease',
                  top: 0,
                  left: 0
                }}
              />
            </div>

            {/* Timeline event markers */}
            {timelineEvents.map((event, index) => {
              const percentage = totalDuration > 0 ? (event.time / totalDuration) * 100 : 0;

              let color = '';
              let label = '';
              switch (event.type) {
                case 'gpt_inquiry':
                  color = '#10a37f';
                  label = 'GPT Event';
                  break;
                case 'copy':
                  color = '#f59e0b';
                  label = 'Copy';
                  break;
                case 'paste':
                  color = '#8b5cf6';
                  label = 'Paste';
                  break;
              }

              const timeString = `${Math.floor(event.time / 60)}:${Math.floor(event.time % 60).toString().padStart(2, '0')}`;

              return (
                <div
                  key={`timeline-marker-${event.type}-${index}`}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${percentage}%`,
                    top: '-15px',
                    transform: 'translateX(-50%)',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => setHoveredEvent({ label, time: timeString, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHoveredEvent({ label, time: timeString, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredEvent(null)}
                >
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '8.75px solid transparent',
                      borderRight: '8.75px solid transparent',
                      borderTop: `14px solid ${color}`,
                    }}
                  />
                </div>
              );
            })}

            {/* Circle handle */}
            <div className="handle absolute w-3 h-3 bg-blue-500 rounded-full shadow-md"
              style={{
                left: `${currentProgress}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}>
            </div>
          </div>
        </div>
        {/* Time display */}
        <div className="flex items-center flex-shrink-0 pl-2">
          <div className="w-10 text-right">{currentTimeFormatted}</div>
          <div className="px-1">/</div>
          <div className="w-10 text-left">{totalTimeFormatted}</div>
        </div>
        {/* Graph toggle button */}
        <button
          onClick={() => {
            const newState = !isGraphExpanded;
            setIsGraphExpanded(newState);
            onGraphToggle?.(newState);
          }}
          className={`ml-2 mr-2 px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
            isGraphExpanded
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          title={isGraphExpanded ? 'Hide word count graph' : 'Show word count graph'}
        >
          <FaChartLine size={12} />
        </button>
      </div>

      {/* Custom Tooltip for timeline events */}
      {hoveredEvent && (
        <div
          className="fixed bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 pointer-events-none"
          style={{
            left: `${hoveredEvent.x + 10}px`,
            top: `${hoveredEvent.y - 60}px`,
          }}
        >
          <div className="text-sm font-semibold">{hoveredEvent.label}</div>
          <div className="text-xs text-gray-300">at {hoveredEvent.time}</div>
        </div>
      )}
    </div>
  );
}
