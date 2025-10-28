"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";
import Papa from "papaparse";
import HorizontalBar from "@/components/horizontalBar";

interface ParticipantOption {
  value: string;
  label: string;
  gender?: string;
  age?: string;
  race?: string;
}

export default function LandingPage() {
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantOption | null>(null);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);

    // Load participant info from CSV
    const loadParticipantInfo = async () => {
      try {
        const response = await fetch("/data/part_info.csv");
        const csvText = await response.text();

        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        // Create participants array with demographic info
        const participantOptions: ParticipantOption[] = Array.from({ length: 77 }, (_, i) => {
          const participantData: any = result.data.find((row: any) => parseInt(row.id) === i);

          if (participantData) {
            return {
              value: `p${i}`,
              label: `Participant ${i + 1} (${participantData.Race}, ${participantData.Gender}, ${participantData.Age})`,
              gender: participantData.Gender,
              age: participantData.Age,
              race: participantData.Race
            };
          }

          return {
            value: `p${i}`,
            label: `Participant ${i + 1}`,
          };
        });

        setParticipants(participantOptions);
        setSelectedParticipant(participantOptions[0]);
      } catch (error) {
        console.error("Error loading participant info:", error);
        // Fallback to basic participants without demographic info
        const basicParticipants = Array.from({ length: 77 }, (_, i) => ({
          value: `p${i}`,
          label: `Participant ${i + 1}`,
        }));
        setParticipants(basicParticipants);
        setSelectedParticipant(basicParticipants[0]);
      }
    };

    loadParticipantInfo();
  }, []);

  const handleStart = () => {
    // Navigate to the replay page with the selected participant
    if (selectedParticipant) {
      router.push(`/replay?participant=${selectedParticipant.value}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-4xl font-bold text-gray-900 text-center">
            GPT Replay
          </h1>
          <p className="text-lg text-gray-600 mt-2 text-center">
            Interactive playback of essay writing sessions with ChatGPT
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Instructions Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Instructions
          </h2>
          <div className="text-gray-700 leading-relaxed space-y-4">
            <p>
              This tool allows you to replay essay writing sessions with
              ChatGPT. Select a participant from the dropdown below and click
              "Start Replay Session" to begin.
            </p>
            <p>
              To start the system, press the play button on the left side of the
              screen. You can pause, rewind, and fast-forward through the
              session to analyze the interaction between the participant and
              ChatGPT.
            </p>
            <p>
              The timeline is annotated with the ChatGPT events, shown as small
              orange triangles on the timeline. Click to seek to these events
              directly.
            </p>
            <p>
              * Note: Seeking may take a few seconds as it plays the session at a high speed until it reaches the desired timestamp.
            </p>
          </div>
        </div>

        {/* Selection and Start Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Get Started
          </h2>

          {/* Participant Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Participant
            </label>
            {isClient ? (
              <Select
                options={participants}
                value={selectedParticipant}
                onChange={(option) => option && setSelectedParticipant(option)}
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
                }}
              />
            ) : (
              <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                Loading...
              </div>
            )}
          </div>

          {/* Horizontal Bar Graphs */}
          <div className="mb-6 space-y-2">
            <HorizontalBar label="Metric 1" current={75} max={100} />
            <HorizontalBar label="Metric 2" current={50} max={150} />
            <HorizontalBar label="Metric 3" current={200} max={200} color="#10a37f" />
          </div>

          {/* Start Button */}
          <button
            onClick={handleStart}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            Start Replay Session
          </button>
        </div>
      </main>
    </div>
  );
}
