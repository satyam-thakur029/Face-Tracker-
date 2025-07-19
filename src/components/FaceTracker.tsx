"use client"

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Define types for face detection
type FaceDetection = {
  type: 'tensorflow' | 'native';
  detectFaces?: (video: HTMLVideoElement) => Promise<any[]>;
  detect?: (video: HTMLVideoElement) => Promise<any[]>;
};

type FaceLandmark = {
  x: number;
  y: number;
};

type Face = {
  topLeft?: [number, number];
  bottomRight?: [number, number];
  probability?: number[];
  landmarks?: FaceLandmark[];
  boundingBox?: DOMRectReadOnly;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: FaceDetectorOptions) => FaceDetector;
  }
}

interface FaceDetector {
  detect: (image: HTMLVideoElement | HTMLImageElement) => Promise<DetectedFace[]>;
}

interface FaceDetectorOptions {
  maxDetectedFaces?: number;
  fastMode?: boolean;
}

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
  landmarks?: FaceLandmark[];
}

const FaceTracker: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [faceDetector, setFaceDetector] = useState<FaceDetection | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [faceCount, setFaceCount] = useState<number>(0);
  const [detectionStats, setDetectionStats] = useState({
    totalDetections: 0,
    avgConfidence: 0
  });

  // Enhanced face detection initialization with multiple fallbacks
  useEffect(() => {
    const initializeFaceDetection = async () => {
      setIsLoading(true);
      
      // Try TensorFlow.js BlazeFace first (most reliable)
      if (await initializeTensorFlowDetection()) return;
      
      // Try browser native Face Detection API
      if (await initializeNativeDetection()) return;
      
      // If all fail, set error
      setError('Face detection not available in this browser. Please use Chrome/Edge for best results.');
      setIsLoading(false);
    };

    const initializeTensorFlowDetection = async (): Promise<boolean> => {
      try {
        const tf = await import('@tensorflow/tfjs');
        const blazeface = await import('@tensorflow-models/blazeface');
        
        await tf.ready();
        const model = await blazeface.load();
        
        setFaceDetector({ 
          type: 'tensorflow',
          detectFaces: async (video: HTMLVideoElement) => {
            const predictions = await model.estimateFaces(video, false);
            return predictions;
          }
        });
        
        setIsLoading(false);
        return true;
      } catch (err) {
        console.warn('TensorFlow.js initialization failed:', err);
        return false;
      }
    };

    const initializeNativeDetection = async (): Promise<boolean> => {
      if (window.FaceDetector) {
        try {
          const detector = new window.FaceDetector({
            maxDetectedFaces: 10,
            fastMode: false
          });
          
          setFaceDetector({ 
            type: 'native',
            detect: async (video: HTMLVideoElement) => {
              const faces = await detector.detect(video);
              return faces;
            }
          });
          
          setIsLoading(false);
          return true;
        } catch (err) {
          console.warn('Native Face Detection not supported:', err);
          return false;
        }
      }
      return false;
    };

    initializeFaceDetection();
  }, []);

  // Enhanced face detection loop with performance monitoring
  const detectFaces = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !faceDetector || video.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    try {
      // Clear and draw video frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let faces: Face[] = [];
      let totalConfidence = 0;

      // Detect faces based on available detector
      if (faceDetector.type === 'tensorflow' && faceDetector.detectFaces) {
        faces = await faceDetector.detectFaces(video);
      } else if (faceDetector.type === 'native' && faceDetector.detect) {
        const detectedFaces = await faceDetector.detect(video);
        faces = detectedFaces.map(face => ({
          boundingBox: face.boundingBox
        }));
      }

      // Update face count
      setFaceCount(faces.length);

      // Draw detected faces
      faces.forEach((face: Face, index: number) => {
        let confidence = 1;
        
        if (faceDetector.type === 'tensorflow') {
          // TensorFlow.js format
          const [x, y] = face.topLeft || [0, 0];
          const [x2, y2] = face.bottomRight || [0, 0];
          confidence = face.probability ? face.probability[0] : 1;
          drawAdvancedBoundingBox(ctx, x, y, x2 - x, y2 - y, `Face ${index + 1}`, confidence);
          
          // Draw landmarks if available
          if (face.landmarks) {
            drawFaceLandmarks(ctx, face.landmarks);
          }
        } else if (faceDetector.type === 'native' && face.boundingBox) {
          // Native API format
          const { x, y, width, height } = face.boundingBox;
          drawAdvancedBoundingBox(ctx, x, y, width, height, `Face ${index + 1}`, confidence);
        }
        
        totalConfidence += confidence;
      });

      // Update detection statistics
      if (faces.length > 0) {
        setDetectionStats(prev => ({
          totalDetections: prev.totalDetections + faces.length,
          avgConfidence: totalConfidence / faces.length
        }));
      }

    } catch (err) {
      console.warn('Face detection error:', err);
    }

    // Continue detection loop
    animationFrameRef.current = requestAnimationFrame(detectFaces);
  }, [faceDetector]);

  // Enhanced bounding box with advanced animations
  const drawAdvancedBoundingBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    confidence: number
  ) => {
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.5 + 0.5;
    const confidenceColor = confidence > 0.8 ? '#00ff00' : confidence > 0.6 ? '#ffff00' : '#ff9500';
    
    // Main bounding box with confidence-based color
    ctx.strokeStyle = `rgba(${confidence > 0.8 ? '0, 255, 0' : confidence > 0.6 ? '255, 255, 0' : '255, 149, 0'}, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = confidenceColor;
    ctx.shadowBlur = 15 + pulse * 10;
    
    // Animated corner brackets
    const cornerSize = Math.min(width, height) * 0.15;
    ctx.lineWidth = 4;
    
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(x, y + cornerSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerSize, y);
    ctx.stroke();
    
    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerSize);
    ctx.stroke();
    
    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(x, y + height - cornerSize);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + cornerSize, y + height);
    ctx.stroke();
    
    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - cornerSize);
    ctx.stroke();
    
    // Scanning line effect
    const scanY = y + (height * ((time * 2) % 1));
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, scanY);
    ctx.lineTo(x + width, scanY);
    ctx.stroke();
    
    // Enhanced label with confidence
    ctx.shadowBlur = 0;
    const confidenceText = `${Math.round(confidence * 100)}%`;
    const labelText = `${label} • ${confidenceText}`;
    
    ctx.font = 'bold 14px "Courier New", monospace';
    const textMetrics = ctx.measureText(labelText);
    const labelWidth = textMetrics.width + 16;
    const labelHeight = 24;
    
    // Label background with glassmorphism effect
    const gradient = ctx.createLinearGradient(x, y - labelHeight - 5, x, y - 5);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y - labelHeight - 5, labelWidth, labelHeight);
    
    // Label text
    ctx.fillStyle = confidenceColor;
    ctx.fillText(labelText, x + 8, y - 12);
    
    // Confidence bar
    const barWidth = labelWidth - 16;
    const barHeight = 3;
    const barY = y - 8;
    
    // Background bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x + 8, barY, barWidth, barHeight);
    
    // Confidence fill
    ctx.fillStyle = confidenceColor;
    ctx.fillRect(x + 8, barY, barWidth * confidence, barHeight);
  };

  // Draw facial landmarks
  const drawFaceLandmarks = (ctx: CanvasRenderingContext2D, landmarks: FaceLandmark[]) => {
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 4) * 0.5 + 0.5;
    
    ctx.fillStyle = `rgba(255, 0, 150, ${0.8 + pulse * 0.2})`;
    ctx.shadowColor = '#ff0096';
    ctx.shadowBlur = 8;
    
    landmarks.forEach((landmark: FaceLandmark) => {
      const size = 2 + pulse;
      ctx.beginPath();
      ctx.arc(landmark.x, landmark.y, size, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    ctx.shadowBlur = 0;
  };

  // Initialize camera
  useEffect(() => {
    const initializeCamera = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && !isLoading && faceDetector) {
        try {
          const constraints = {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
              frameRate: { ideal: 30, max: 60 }
            },
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          video.srcObject = stream;
          
          video.addEventListener('loadeddata', () => {
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            
            // Start detection loop
            detectFaces();
          });

          await video.play();
        } catch (error) {
          console.error('Error accessing camera:', error);
          setError('Camera access denied or not available. Please grant camera permissions.');
        }
      }
    };

    if (!isLoading && faceDetector) {
      initializeCamera();
    }

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading, faceDetector, detectFaces]);

  // Enhanced recording functionality
  const startRecording = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const stream = canvas.captureStream(60); // Higher frame rate
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // Higher quality
      });

      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `face-tracking-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
      };

      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      setError('Recording not supported in this browser');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const resetStats = () => {
    setDetectionStats({
      totalDetections: 0,
      avgConfidence: 0
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 to-blue-800 text-white">
        <div className="text-center p-10">
          <div className="w-16 h-16 border-4 border-opacity-30 border-white rounded-full animate-spin mx-auto mb-6"
            style={{ borderTopColor: '#00ff00' }} />
          <h3 className="text-2xl font-bold mb-2">Initializing AI Face Detection</h3>
          <p className="text-blue-200">Loading advanced neural networks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 md:p-8">
      {/* Header Section */}
      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">
          🎯 AI Face Tracker Pro
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Advanced real-time face detection with neural networks and high-quality recording
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-xl p-4 border border-gray-700">
          <div className="text-3xl font-bold text-green-400">{faceCount}</div>
          <div className="text-gray-300">Faces Detected</div>
        </div>
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-xl p-4 border border-gray-700">
          <div className="text-3xl font-bold text-green-400">{detectionStats.totalDetections}</div>
          <div className="text-gray-300">Total Detections</div>
        </div>
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-xl p-4 border border-gray-700">
          <div className="text-3xl font-bold text-green-400">
            {Math.round(detectionStats.avgConfidence * 100)}%
          </div>
          <div className="text-gray-300">Avg Confidence</div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-4 rounded-lg mb-8 text-center shadow-lg">
          ❌ {error}
        </div>
      )}

      {/* Video Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl mb-8 max-w-4xl mx-auto border-2 border-green-500 border-opacity-30">
        <video 
          ref={videoRef} 
          className="hidden" 
          playsInline
          muted
        />
        <canvas 
          ref={canvasRef} 
          className="w-full h-auto"
          width={1280} 
          height={720}
        />
        
        {/* Face Count Indicator */}
        {faceCount > 0 && (
          <div className="absolute top-4 left-4 bg-green-500 bg-opacity-90 text-black px-3 py-1 rounded-full font-bold text-sm">
            👥 {faceCount} face{faceCount !== 1 ? 's' : ''}
          </div>
        )}
        
        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 border border-red-500 border-opacity-50">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="font-bold">RECORDING</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-4 mb-12">
        {!isRecording ? (
          <button 
            onClick={startRecording}
            disabled={!!error}
            className="px-6 py-3 bg-gradient-to-r from-pink-600 to-red-600 text-white rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-red-500/30"
          >
            <span className="text-xl">🎬</span> Start Recording
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg hover:shadow-gray-500/30"
          >
            <span className="text-xl">⏹️</span> Stop Recording
          </button>
        )}
        
        <button 
          onClick={resetStats}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg hover:shadow-blue-500/30"
        >
          <span className="text-xl">🔄</span> Reset Stats
        </button>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-xl p-6 border border-gray-700 hover:border-green-400 transition-colors">
          <div className="text-4xl mb-4">🧠</div>
          <h3 className="text-xl font-bold mb-2 text-green-400">AI Detection</h3>
          <p className="text-gray-300">
            Powered by TensorFlow.js BlazeFace model for accurate real-time face detection
          </p>
        </div>
        
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-xl p-6 border border-gray-700 hover:border-blue-400 transition-colors">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-bold mb-2 text-blue-400">Live Analytics</h3>
          <p className="text-gray-300">
            Real-time confidence scores, face counting, and detection statistics
          </p>
        </div>
        
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-xl p-6 border border-gray-700 hover:border-purple-400 transition-colors">
          <div className="text-4xl mb-4">🎥</div>
          <h3 className="text-xl font-bold mb-2 text-purple-400">High-Quality Recording</h3>
          <p className="text-gray-300">
            Record face tracking sessions in high quality with all visual overlays
          </p>
        </div>
        
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-xl p-6 border border-gray-700 hover:border-yellow-400 transition-colors">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="text-xl font-bold mb-2 text-yellow-400">Real-time Processing</h3>
          <p className="text-gray-300">
            60 FPS processing with optimized algorithms for smooth performance
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-gray-400 text-sm">
        <p>AI Face Tracker Pro © {new Date().getFullYear()} - All rights reserved</p>
      </footer>
    </div>
  );
};

export default FaceTracker;