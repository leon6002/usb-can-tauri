import React from "react";
import { useAudioStore } from "@/store/audioStore";
import { Volume2, VolumeX } from "lucide-react";

const AudioControl: React.FC = () => {
    const { isMuted, toggleMute } = useAudioStore();

    return (
        <div className="w-full">
            <button
                onClick={toggleMute}
                className={`w-full px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 backdrop-blur-sm border flex items-center justify-center gap-2 ${!isMuted
                        ? "bg-blue-500/80 border-blue-400/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                        : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white"
                    }`}
            >
                {isMuted ? (
                    <>
                        <VolumeX className="w-4 h-4" />
                        <span>UNMUTE AUDIO</span>
                    </>
                ) : (
                    <>
                        <Volume2 className="w-4 h-4" />
                        <span>MUTE AUDIO</span>
                    </>
                )}
            </button>
        </div>
    );
};

export default AudioControl;
