
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ onModeChange, currentMode, onHandPosition }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<string>("Initializing...");
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  const lastModeRef = useRef<TreeMode>(currentMode);
  
  // Debounce logic refs
  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const CONFIDENCE_THRESHOLD = 5; // Number of consecutive frames to confirm gesture

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        // Use jsDelivr CDN (accessible in China)
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        // Use local model file to avoid loading from Google Storage (blocked in China)
        // Model file should be downloaded using: npm run download-model or download-model.bat/.sh
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `/models/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        console.warn("Gesture control is unavailable. The app will still work without it.");
        setGestureStatus("Gesture control unavailable");
        // Don't block the app if gesture control fails
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user" }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setIsLoaded(true);
            setGestureStatus("Waiting for hand...");
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
          setGestureStatus("Permission Denied");
        }
      }
    };

    const drawHandSkeleton = (landmarks: any[]) => {
      if (!canvasRef.current || !videoRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Hand connections (MediaPipe hand model)
      const connections = [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [0, 5], [5, 6], [6, 7], [7, 8],
        // Middle finger
        [0, 9], [9, 10], [10, 11], [11, 12],
        // Ring finger
        [0, 13], [13, 14], [14, 15], [15, 16],
        // Pinky
        [0, 17], [17, 18], [18, 19], [19, 20],
        // Palm
        [5, 9], [9, 13], [13, 17]
      ];

      // Draw connections (lines)
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#D4AF37'; // Gold color
      connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.stroke();
      });

      // Draw landmarks (points)
      landmarks.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        
        // Use green for all points
        ctx.fillStyle = '#228B22'; // Forest green color
        ctx.fill();
        
        // Add outline
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;

      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) { // Ensure video is ready
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          drawHandSkeleton(landmarks);
          detectGesture(landmarks);
        } else {
            setGestureStatus("No hand detected");
            setHandPos(null); // Clear hand position when no hand detected
            if (onHandPosition) {
              onHandPosition(0.5, 0.5, false); // No hand detected
            }
            // Clear canvas when no hand detected
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              }
            }
            // Reset counters if hand is lost? 
            // Better to keep them to prevent flickering if hand blips out for 1 frame
            openFrames.current = Math.max(0, openFrames.current - 1);
            closedFrames.current = Math.max(0, closedFrames.current - 1);
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    const detectGesture = (landmarks: any[]) => {
      // 0 is Wrist
      // Tips: 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
      // Bases (MCP): 5, 9, 13, 17
      
      const wrist = landmarks[0];
      
      // Calculate palm center (average of wrist and finger bases)
      // Finger bases (MCP joints): 5, 9, 13, 17
      const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
      const palmCenterY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;
      
      // Send hand position for camera control
      // Normalize coordinates: x and y are in [0, 1], center at (0.5, 0.5)
      setHandPos({ x: palmCenterX, y: palmCenterY });
      if (onHandPosition) {
        onHandPosition(palmCenterX, palmCenterY, true);
      }
      
      const fingerTips = [8, 12, 16, 20];
      const fingerBases = [5, 9, 13, 17];
      
      let extendedFingers = 0;

      for (let i = 0; i < 4; i++) {
        const tip = landmarks[fingerTips[i]];
        const base = landmarks[fingerBases[i]];
        
        // Calculate distance from wrist to tip vs wrist to base
        const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const distBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);
        
        // Heuristic: If tip is significantly further from wrist than base, it's extended
        if (distTip > distBase * 1.5) { // 1.5 multiplier is a safe heuristic for extension
          extendedFingers++;
        }
      }
      
      // Thumb check (Tip 4 vs Base 2)
      const thumbTip = landmarks[4];
      const thumbBase = landmarks[2];
      const distThumbTip = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
      const distThumbBase = Math.hypot(thumbBase.x - wrist.x, thumbBase.y - wrist.y);
      if (distThumbTip > distThumbBase * 1.2) extendedFingers++;

      // DECISION
      if (extendedFingers >= 4) {
        // OPEN HAND -> UNLEASH (CHAOS)
        openFrames.current++;
        closedFrames.current = 0;
        
        setGestureStatus("Detected: OPEN (Unleash)");

        if (openFrames.current > CONFIDENCE_THRESHOLD) {
            if (lastModeRef.current !== TreeMode.CHAOS) {
                lastModeRef.current = TreeMode.CHAOS;
                onModeChange(TreeMode.CHAOS);
            }
        }

      } else if (extendedFingers <= 1) {
        // CLOSED FIST -> RESTORE (FORMED)
        closedFrames.current++;
        openFrames.current = 0;
        
        setGestureStatus("Detected: CLOSED (Restore)");

        if (closedFrames.current > CONFIDENCE_THRESHOLD) {
            if (lastModeRef.current !== TreeMode.FORMED) {
                lastModeRef.current = TreeMode.FORMED;
                onModeChange(TreeMode.FORMED);
            }
        }
      } else {
        // Ambiguous
        setGestureStatus("Detected: ...");
        openFrames.current = 0;
        closedFrames.current = 0;
      }
    };

    setupMediaPipe();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  }, [onModeChange]);

  // Sync ref with prop updates to prevent overriding in closure
  useEffect(() => {
    lastModeRef.current = currentMode;
  }, [currentMode]);

  return (
    <div className="absolute top-6 right-[8%] z-50 flex flex-col items-end pointer-events-none">

      
      {/* Camera Preview Frame */}
      <div className="relative w-[18.75vw] h-[14.0625vw] border-2 border-[#D4AF37] rounded-lg overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-black">
        {/* Decorative Lines */}
        <div className="absolute inset-0 border border-[#F5E6BF]/20 m-1 rounded-sm z-10"></div>
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Canvas for hand skeleton overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none z-20"
        />
        
        {/* Hand Position Debug */}
        {/* {handPos && (
          <div className="absolute top-2 left-2 text-[10px] text-[#D4AF37] bg-black/70 px-2 py-1 rounded font-mono">
            X: {handPos.x.toFixed(2)} Y: {handPos.y.toFixed(2)}
          </div>
        )} */}
        
        {/* Hand Position Indicator */}
        {handPos && (
          <div 
            className="absolute w-2 h-2 bg-[#D4AF37] rounded-full border border-white"
            style={{
              left: `${(1 - handPos.x) * 100}%`,
              top: `${handPos.y * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}
    
      </div>
    </div>
  );
};
