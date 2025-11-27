import { create } from "zustand";

interface AudioState {
    isMuted: boolean;
    toggleMute: () => void;
    setMuted: (muted: boolean) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
    isMuted: true, // Default to muted
    toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    setMuted: (muted) => set({ isMuted: muted }),
}));
