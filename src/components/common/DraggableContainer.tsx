import React, { useState, useRef, useEffect } from "react";
import { GripHorizontal } from "lucide-react";

interface DraggableContainerProps {
    children: React.ReactNode;
    initialPosition?: { x: number; y: number };
    className?: string;
}

export const DraggableContainer: React.FC<DraggableContainerProps> = ({
    children,
    initialPosition = { x: 0, y: 0 },
    className = "",
}) => {
    const [position, setPosition] = useState(initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const startPosRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - startPosRef.current.x;
            const dy = e.clientY - startPosRef.current.y;

            setPosition((prev) => ({
                x: prev.x + dx,
                y: prev.y + dy,
            }));

            startPosRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow dragging from the handle
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            startPosRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    return (
        <div
            ref={dragRef}
            className={`absolute ${className} ${isDragging ? 'cursor-grabbing' : ''}`}
            style={{
                left: position.x,
                top: position.y,
                touchAction: "none",
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Drag Handle */}
            <div className="drag-handle absolute -top-6 left-1/2 transform -translate-x-1/2 cursor-grab active:cursor-grabbing p-1 bg-white/20 backdrop-blur-md rounded-t-lg hover:bg-white/30 transition-colors">
                <GripHorizontal className="w-4 h-4 text-white/60" />
            </div>

            {children}
        </div>
    );
};
