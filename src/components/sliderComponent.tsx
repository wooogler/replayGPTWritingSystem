"use client";
import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { FaPlay, FaPause } from "react-icons/fa6";
import { FaTachometerAlt } from "react-icons/fa";
import { TimelineEvent } from "./types";

const speeds = [
  { value: 0.1, label: ".1x" },
  { value: 0.5, label: ".5x" },
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 10, label: "10x" },
  { value: 100, label: "100x" },
];

interface SliderProps {
  onSpeedChange: (newSpeed: number) => void;
  onPlayChange: (isPlaying: boolean) => void;
  onSeek: (percentage: number) => void;
  currentProgress?: number; // 0-100 percentage
  totalDuration?: number; // in seconds
  timelineEvents?: TimelineEvent[]; // Array of timeline events
}

export default function SliderComponent({
  onSpeedChange,
  onPlayChange,
  onSeek,
  currentProgress = 0,
  totalDuration = 0,
  timelineEvents = []
}: SliderProps) {
  const [isClient, setIsClient] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState(speeds[2]); // Default to 1x (index 2)
  const [hoveredEvent, setHoveredEvent] = useState<{label: string, time: string, x: number, y: number} | null>(null);
  const seekBarRef = useRef(null);

  const handleSpeedChange = (selectedOption) => {
    setSelectedSpeed(selectedOption);
    onSpeedChange(selectedOption.value);
  }

  const handlePlay = () => {
    console.log("Play button clicked");
    setPlaying(true);
    onPlayChange(true);
  };

  const handlePause = () => {
    console.log("Pause button clicked");
    setPlaying(false);
    onPlayChange(false);
  }

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    console.log("Seeking to percentage:", percentage.toFixed(3));
    onSeek(percentage);
  };

  const handleMouseDown = (e) => {
  e.preventDefault(); // Prevents text selection while dragging

  const handleMouseMove = (e) => {
    // Find the seek bar container (parent of the handle)
    const seekBar = document.querySelector('.seek-bar');
    if (!seekBar) return;

    const rect = seekBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // Clamp between 0 and rect.width to prevent going outside bounds
    const clampedX = Math.max(0, Math.min(clickX, rect.width));
    const percentage = (clampedX / rect.width) * 100;

    onSeek(percentage);
  };

  const handleMouseUp = () => {
    // Clean up: remove the global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Add global listeners so dragging works anywhere on the page
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};


  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentTime = (currentProgress / 100) * totalDuration;
  const currentTimeFormatted = formatTime(currentTime);
  const totalTimeFormatted = formatTime(totalDuration);

  return (
    <>
      <div
        id="controls"
        className="mt-1 flex justify-center flex-col items-center w-full"
      >

        {/* Playback controls */}
        <div className="justify-center flex gap-1 w-[90%]">
          <button
            id="play"
            onClick={handlePlay}
            className="px-2"
          >
            <FaPlay size={19} />
          </button>
          <button
            id="pause"
            onClick={handlePause}
          >
            <FaPause size={21} />
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
          <div className="seek-bar-container flex-grow flex items-center">
            <div
              ref={seekBarRef}
              onClick={handleSeek}
              onMouseDown={handleMouseDown}
              className="seek-bar h-2 rounded cursor-pointer w-full relative bg-gray-600"
            >
              {/* Progress fill */}
              <div
                className="absolute h-full bg-[#2196f3] rounded"
                style={{
                  width: `${currentProgress}%`,
                  transition: 'width 0.1s ease',
                  top: 0,
                  left: 0
                }}
              />

              {/* Timeline event markers */}
              {timelineEvents.map((event, index) => {
                const percentage = totalDuration > 0 ? (event.time / totalDuration) * 100 : 0;

                // Determine color and label based on event type
                let color = '';
                let label = '';
                switch (event.type) {
                  case 'gpt_inquiry':
                    color = '#10a37f'; // Teal/green
                    label = 'GPT Event';
                    break;
                  case 'copy':
                    color = '#f59e0b'; // Orange/amber
                    label = 'Copy';
                    break;
                  case 'paste':
                    color = '#8b5cf6'; // Purple/violet
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
          {/* Time display in separate container with fixed width */}
          <div className="flex-shrink-0 w-20 pl-3 pb-1">
            <p>{currentTimeFormatted}/{totalTimeFormatted}</p>
          </div>
      </div>

      {/* Custom Tooltip */}
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
    </>
  );
}
