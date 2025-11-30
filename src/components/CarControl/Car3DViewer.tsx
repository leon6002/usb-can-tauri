import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Scene, SceneHandle } from "../Car3D/r3f/Scene";
import { use3DStore } from "../../store/car3DStore";

export const Car3DViewer: React.FC = () => {
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sceneHandleRef = useRef<SceneHandle | null>(null);
  const setSceneHandle = use3DStore((state) => state.setSceneHandle);

  // Enforce minimum loading time of 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinTimeElapsed(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Handle fade out when loading is complete
  useEffect(() => {
    if (isSceneReady && isMinTimeElapsed) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 1000); // 1 second fade out duration
      return () => clearTimeout(timer);
    }
  }, [isSceneReady, isMinTimeElapsed]);

  const handleSceneReady = (sceneHandle: SceneHandle) => {
    sceneHandleRef.current = sceneHandle;
    setSceneHandle(sceneHandle as any); // 将 sceneHandle 设置到 store 中
    setIsSceneReady(true);
    console.log("✅ 3D Scene ready:", sceneHandle);
  };

  const handleError = (error: Error) => {
    console.error("Scene error:", error);
    setError(error.message);
    // If error occurs, we still want to remove loading screen eventually to show error
    setIsSceneReady(true);
  };

  return (
    <div className="w-full h-full absolute inset-0">
      <div className="w-full h-full relative bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* 3D Scene */}
        <Scene onSceneReady={handleSceneReady} onError={handleError} />

        {/* Loading Indicator - Chip & Circuit Design */}
        {isVisible && createPortal(
          <div className={`fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden transition-opacity duration-1000 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
            {/* Background Grid Effect */}
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }}
            />

            {/* Radial Gradient Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/50 to-slate-950 pointer-events-none" />

            <div className="relative z-20 flex flex-col items-center">
              {/* Chip & Circuits Container */}
              <div className="relative w-80 h-80 flex items-center justify-center mb-8">

                {/* Circuit Lines (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 320 320">
                  <defs>
                    <linearGradient id="pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(6, 182, 212, 0)" />
                      <stop offset="50%" stopColor="rgba(6, 182, 212, 1)" />
                      <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Circuit Paths */}
                  <g stroke="rgba(6, 182, 212, 0.2)" strokeWidth="2" fill="none">
                    {/* Top */}
                    <path d="M160 120 V 60 H 100 V 20" />
                    <path d="M160 120 V 80 H 220 V 40" />
                    {/* Right */}
                    <path d="M200 160 H 260 V 100 H 300" />
                    <path d="M200 160 H 240 V 220 H 280" />
                    {/* Bottom */}
                    <path d="M160 200 V 260 H 220 V 300" />
                    <path d="M160 200 V 240 H 100 V 280" />
                    {/* Left */}
                    <path d="M120 160 H 60 V 220 H 20" />
                    <path d="M120 160 H 80 V 100 H 40" />
                  </g>

                  {/* Animated Pulses */}
                  <g stroke="url(#pulse-gradient)" strokeWidth="2" fill="none" filter="url(#glow)">
                    {/* Top Pulses */}
                    <path d="M160 120 V 60 H 100 V 20" className="animate-circuit-pulse" style={{ strokeDasharray: '100, 400', strokeDashoffset: 500 }} />
                    <path d="M160 120 V 80 H 220 V 40" className="animate-circuit-pulse-delay-1" style={{ strokeDasharray: '80, 400', strokeDashoffset: 480 }} />

                    {/* Right Pulses */}
                    <path d="M200 160 H 260 V 100 H 300" className="animate-circuit-pulse-delay-2" style={{ strokeDasharray: '100, 400', strokeDashoffset: 500 }} />
                    <path d="M200 160 H 240 V 220 H 280" className="animate-circuit-pulse" style={{ strokeDasharray: '80, 400', strokeDashoffset: 480 }} />

                    {/* Bottom Pulses */}
                    <path d="M160 200 V 260 H 220 V 300" className="animate-circuit-pulse-delay-1" style={{ strokeDasharray: '100, 400', strokeDashoffset: 500 }} />
                    <path d="M160 200 V 240 H 100 V 280" className="animate-circuit-pulse-delay-2" style={{ strokeDasharray: '80, 400', strokeDashoffset: 480 }} />

                    {/* Left Pulses */}
                    <path d="M120 160 H 60 V 220 H 20" className="animate-circuit-pulse" style={{ strokeDasharray: '100, 400', strokeDashoffset: 500 }} />
                    <path d="M120 160 H 80 V 100 H 40" className="animate-circuit-pulse-delay-1" style={{ strokeDasharray: '80, 400', strokeDashoffset: 480 }} />
                  </g>
                </svg>

                {/* Central Chip */}
                <div className="relative w-24 h-24 bg-slate-900 rounded-lg border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)] flex items-center justify-center z-10">
                  {/* Inner Chip Detail */}
                  <div className="w-20 h-20 bg-slate-800 rounded border border-cyan-500/20 flex items-center justify-center relative overflow-hidden">
                    {/* Scanning Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-scan-vertical"></div>

                    {/* Chip Logo/Icon */}
                    <div className="text-cyan-400 font-mono font-bold text-xl tracking-widest z-10">
                      RH850
                    </div>

                    {/* Micro-circuit details */}
                    <div className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(6, 182, 212, 0.1) 2px, rgba(6, 182, 212, 0.1) 4px)'
                      }}
                    />
                  </div>

                  {/* Pins */}
                  {/* Top */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-16 h-1 flex justify-between">
                    {[...Array(6)].map((_, i) => <div key={`t-${i}`} className="w-1 h-2 -mt-1 bg-cyan-600/50 rounded-sm" />)}
                  </div>
                  {/* Bottom */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 flex justify-between">
                    {[...Array(6)].map((_, i) => <div key={`b-${i}`} className="w-1 h-2 -mb-1 bg-cyan-600/50 rounded-sm" />)}
                  </div>
                  {/* Left */}
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-16 w-1 flex flex-col justify-between">
                    {[...Array(6)].map((_, i) => <div key={`l-${i}`} className="h-1 w-2 -ml-1 bg-cyan-600/50 rounded-sm" />)}
                  </div>
                  {/* Right */}
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-16 w-1 flex flex-col justify-between">
                    {[...Array(6)].map((_, i) => <div key={`r-${i}`} className="h-1 w-2 -mr-1 bg-cyan-600/50 rounded-sm" />)}
                  </div>

                  {/* Corner Glows */}
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-cyan-400 rounded-full blur-[2px] animate-pulse"></div>
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full blur-[2px] animate-pulse delay-700"></div>
                </div>
              </div>

              {/* Loading Text */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-[0.2em] animate-pulse">
                  SYSTEM INITIALIZING
                </h2>
                <div className="flex items-center justify-center gap-2 text-cyan-400/60 font-mono text-xs">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce delay-100">●</span>
                  <span className="animate-bounce delay-200">●</span>
                  <span>LOADING MODULES</span>
                </div>
              </div>
            </div>
          </div >,
          document.body
        )}

        {/* Error Display */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <p className="text-red-600 font-bold">Loading Failed</p>
              <p className="text-gray-600 text-sm mt-2">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
