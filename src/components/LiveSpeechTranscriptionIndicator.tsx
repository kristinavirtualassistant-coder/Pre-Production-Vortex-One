import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  Copy,
  Check,
  FileText,
  Trash2,
  Sparkles,
  AlertCircle,
  Activity,
  Layers,
  Settings2,
} from 'lucide-react';

interface LiveSpeechTranscriptionIndicatorProps {
  isCallActive: boolean;
  isMuted?: boolean;
  onTranscriptChange?: (fullTranscript: string) => void;
  onAppendToNotes?: (text: string) => void;
  contactName?: string;
}

interface TranscriptEntry {
  id: string;
  speaker: 'Agent' | 'Owner';
  text: string;
  timestamp: string;
  isFinal: boolean;
}

// Global declaration for Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export const LiveSpeechTranscriptionIndicator: React.FC<LiveSpeechTranscriptionIndicatorProps> = ({
  isCallActive,
  isMuted = false,
  onTranscriptChange,
  onAppendToNotes,
  contactName = 'Lead/Owner',
}) => {
  const [isListening, setIsListening] = useState<boolean>(true);
  const [interimText, setInterimText] = useState<string>('');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('en-US');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [speechApiSupported, setSpeechApiSupported] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll transcript container on new entries
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcriptEntries, interimText]);

  // Audio Visualizer Setup using Web Audio API
  const startAudioVisualizer = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average RMS audio level (0 - 100)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 255) * 160));
        setAudioLevel(normalized);

        // Draw waveform bars
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = Math.max(3, (dataArray[i] / 255) * (canvas.height - 4));

          // Gradient color from cyan to indigo
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, '#06b6d4');
          gradient.addColorStop(0.5, '#0284c7');
          gradient.addColorStop(1, '#4f46e5');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          // Draw symmetric rounded bars centered vertically
          const y = (canvas.height - barHeight) / 2;
          ctx.roundRect(x, y, barWidth - 2, barHeight, 2);
          ctx.fill();

          x += barWidth;
        }

        animationFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err: any) {
      console.warn('Microphone visualizer init notice:', err);
      // Fallback synthetic animated waveform if mic is blocked in sandboxed frame
      let phase = 0;
      const drawFallback = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        phase += 0.08;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const bars = 24;
        const barWidth = canvas.width / bars;

        for (let i = 0; i < bars; i++) {
          const dynamicHeight = Math.max(
            4,
            Math.sin(phase + i * 0.35) * (canvas.height / 2.5) + (canvas.height / 3.2)
          );
          const y = (canvas.height - dynamicHeight) / 2;

          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, '#06b6d4');
          gradient.addColorStop(1, '#6366f1');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(i * barWidth, y, barWidth - 2, dynamicHeight, 2);
          ctx.fill();
        }

        animationFrameRef.current = requestAnimationFrame(drawFallback);
      };
      drawFallback();
    }
  }, []);

  const stopAudioVisualizer = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Web SpeechRecognition Initialization
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSpeechApiSupported(false);
      return;
    }

    setSpeechApiSupported(true);

    if (!isCallActive || !isListening || isMuted) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      stopAudioVisualizer();
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setPermissionError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            const trimmed = transcriptChunk.trim();
            if (trimmed) {
              setTranscriptEntries((prev) => {
                const newEntries: TranscriptEntry[] = [
                  ...prev,
                  {
                    id: `tr-${Date.now()}-${Math.random()}`,
                    speaker: 'Agent',
                    text: trimmed,
                    timestamp: timeStr,
                    isFinal: true,
                  },
                ];
                if (onTranscriptChange) {
                  onTranscriptChange(
                    newEntries.map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`).join('\n')
                  );
                }
                return newEntries;
              });
            }
          } else {
            currentInterim += transcriptChunk;
          }
        }
        setInterimText(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition event code:', event.error);
        if (event.error === 'not-allowed') {
          setPermissionError('Microphone permission required for SpeechRecognition');
        } else if (event.error === 'network') {
          // Keep listening
        }
      };

      recognition.onend = () => {
        // Restart speech recognition automatically if call is still ongoing and listening is enabled
        if (isCallActive && isListening) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {}

      startAudioVisualizer();
    } catch (err: any) {
      console.error('Failed to initialize SpeechRecognition:', err);
      setPermissionError(err.message || 'Speech recognition initialization failed');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      stopAudioVisualizer();
    };
  }, [
    isCallActive,
    isListening,
    isMuted,
    language,
    onTranscriptChange,
    startAudioVisualizer,
    stopAudioVisualizer,
  ]);

  // Copy full transcript to clipboard
  const handleCopyTranscript = () => {
    const fullText = transcriptEntries
      .map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullText || interimText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sync / append current transcript to Call Notes
  const handleAppendToCallNotes = () => {
    const textToAppend = transcriptEntries.map((e) => e.text).join(' ');
    if (onAppendToNotes && textToAppend) {
      onAppendToNotes(textToAppend);
    }
  };

  // Clear live transcription buffer
  const handleClearTranscript = () => {
    setTranscriptEntries([]);
    setInterimText('');
    if (onTranscriptChange) onTranscriptChange('');
  };

  // Simulation test phrase for quick verification
  const handleInjectSampleSpeech = (speaker: 'Agent' | 'Owner', phrase: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    setTranscriptEntries((prev) => {
      const newEntries: TranscriptEntry[] = [
        ...prev,
        {
          id: `tr-sample-${Date.now()}`,
          speaker,
          text: phrase,
          timestamp: timeStr,
          isFinal: true,
        },
      ];
      if (onTranscriptChange) {
        onTranscriptChange(
          newEntries.map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`).join('\n')
        );
      }
      return newEntries;
    });
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 shadow-md space-y-3">
      {/* Header: Status Indicator & Controls */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-3 h-3 rounded-full ${
                isListening && isCallActive ? 'bg-emerald-500 animate-ping opacity-75' : 'bg-slate-600'
              } absolute`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isListening && isCallActive ? 'bg-emerald-400' : 'bg-slate-500'
              } relative`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                Live Speech-to-Text &amp; Audio Stream
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                Web Speech API
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isMuted
                ? '🔇 Microphone muted — audio stream paused'
                : isListening
                ? 'Continuous transcription active on microphone audio channel'
                : 'Live transcription paused'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Speech Recognition Language"
            className="text-[11px] bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="en-US">EN (US)</option>
            <option value="es-US">ES (US)</option>
          </select>

          <button
            onClick={() => setIsListening(!isListening)}
            title={isListening ? 'Mute Speech Recognition' : 'Resume Speech Recognition'}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              isListening
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>

          {transcriptEntries.length > 0 && (
            <>
              <button
                onClick={handleCopyTranscript}
                title="Copy full transcription"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleClearTranscript}
                title="Clear transcript"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-md border border-slate-700 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Real-time Waveform Canvas */}
      <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2 shrink-0">
          <Volume2 className={`w-4 h-4 ${audioLevel > 15 ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            Audio Stream
          </span>
        </div>

        {/* Visualizer Canvas */}
        <div className="flex-1 h-8 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={280}
            height={32}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="shrink-0 flex items-center space-x-1.5">
          <span className="text-[10px] font-mono text-cyan-400 font-bold">
            {isListening ? `${audioLevel} dB` : 'MUTED'}
          </span>
        </div>
      </div>

      {/* Permission or API Notice if any */}
      {!speechApiSupported && (
        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-[11px] text-amber-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            Web SpeechRecognition API is not natively available in this browser environment. You can test live audio streaming and simulation below.
          </div>
        </div>
      )}

      {permissionError && (
        <div className="p-2 rounded bg-rose-950/50 border border-rose-800/60 text-[11px] text-rose-300 flex items-center justify-between">
          <span>{permissionError}</span>
          <button
            onClick={() => setPermissionError(null)}
            className="text-[10px] underline text-rose-200 ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Transcription Feed */}
      <div
        ref={transcriptContainerRef}
        className="h-32 overflow-y-auto rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 space-y-1.5 text-xs font-sans scroll-smooth"
      >
        {transcriptEntries.length === 0 && !interimText && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-4 space-y-1.5">
            <Activity className="w-5 h-5 text-slate-600 animate-pulse" />
            <p className="text-[11px]">
              Listening for live conversation... Speak into your microphone to transcribe in real-time.
            </p>
          </div>
        )}

        {transcriptEntries.map((entry) => (
          <div key={entry.id} className="flex items-start space-x-2 leading-relaxed">
            <span className="text-[10px] font-mono text-slate-500 shrink-0 pt-0.5">
              {entry.timestamp}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                entry.speaker === 'Agent'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
              }`}
            >
              {entry.speaker}
            </span>
            <span className="text-slate-200 text-xs">{entry.text}</span>
          </div>
        ))}

        {/* Interim Text (Pending Speech Phrase) */}
        {interimText && (
          <div className="flex items-start space-x-2 leading-relaxed text-cyan-300/80 italic animate-pulse">
            <span className="text-[10px] font-mono text-cyan-500 shrink-0 pt-0.5">Live</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-400 shrink-0">
              Agent
            </span>
            <span className="text-xs">{interimText}...</span>
          </div>
        )}
      </div>

      {/* Footer Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center space-x-1.5">
          {onAppendToNotes && transcriptEntries.length > 0 && (
            <button
              onClick={handleAppendToCallNotes}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer shadow-xs"
            >
              <FileText className="w-3 h-3" />
              Append to Call Notes
            </button>
          )}

          <button
            onClick={() =>
              handleInjectSampleSpeech(
                'Agent',
                'Thank you for taking my call regarding the property on Newport Blvd. Are you considering selling or 1031 exchange?'
              )
            }
            className="text-[10px] font-medium text-slate-400 hover:text-cyan-300 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer"
          >
            + Test Speech Log
          </button>
        </div>

        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          {transcriptEntries.length} phrase{transcriptEntries.length === 1 ? '' : 's'} logged
        </div>
      </div>
    </div>
  );
};
