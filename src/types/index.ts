export interface VideoRecorderProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
}

export interface FaceTrackerProps {
  videoStream: MediaStream | null;
}

export interface FaceDetectionResult {
  faces: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}