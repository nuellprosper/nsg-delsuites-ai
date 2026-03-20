import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied. Please enable it in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="group relative flex items-center justify-center w-24 h-24 bg-white border-4 border-black rounded-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
        >
          <Mic size={40} className="text-black group-hover:text-yellow-500" />
          <span className="absolute -bottom-10 w-32 font-black text-xs uppercase tracking-widest">Start Recording</span>
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="group relative flex items-center justify-center w-24 h-24 bg-red-500 border-4 border-black rounded-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-pulse"
        >
          <Square size={40} className="text-white" />
          <span className="absolute -bottom-10 w-32 font-black text-xs uppercase tracking-widest text-red-600">Stop Recording</span>
        </button>
      )}
    </div>
  );
}
