import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { 
  FolderOpen, 
  FileAudio, 
  Clock, 
  FileText,
  Play,
  Pause,
  RotateCw
} from 'lucide-react';

// If you use TypeScript, add these interfaces
interface AudioFile {
  name: string;
  handle: FileSystemFileHandle;
  year: string;
  month: string;
  day: string;
  time: string;
  fullDate: Date;
}

interface GroupedFiles {
  [key: string]: {
    [key: string]: AudioFile[];
  };
}

const AudioManager = () => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  
  // Audio playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(new Audio());
  const transciberRef = useRef<any>(null);

  // Initialize Whisper model
  useEffect(() => {
    const initTranscriber = async () => {
      try {
        const { pipeline } = await import('@xenova/transformers');
        transciberRef.current = await pipeline(
          'automatic-speech-recognition',
          'Xenova/whisper-small',
          {
            progress_callback: (progress: any) => {
              if (progress.status === 'progress') {
                setTranscriptionProgress(Math.round(progress.progress * 100));
              }
            }
          }
        );
      } catch (error) {
        console.error('Error initializing transcriber:', error);
      }
    };
    initTranscriber();
  }, []);

  // Handle audio time updates
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Parse filename into date components
  const parseFileName = (filename: string) => {
    const match = filename.match(/(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})\.mp3/);
    if (match) {
      const [_, year, month, day, hour, minute] = match;
      return {
        year: `20${year}`,
        month,
        day,
        time: `${hour}:${minute}`,
        fullDate: new Date(`20${year}`, parseInt(month) - 1, day, hour, minute)
      };
    }
    return null;
  };

  // Handle folder selection
  const handleFolderSelect = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const audioFiles: AudioFile[] = [];
      
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.match(/^\d{6}_\d{4}\.mp3$/)) {
          const dateInfo = parseFileName(entry.name);
          if (dateInfo) {
            audioFiles.push({
              name: entry.name,
              handle: entry,
              ...dateInfo
            });
          }
        }
      }
      
      audioFiles.sort((a, b) => b.fullDate.getTime() - a.fullDate.getTime());
      setFiles(audioFiles);
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  // Handle file selection and playback
  const handleFileSelect = async (file: AudioFile) => {
    try {
      const fileHandle = file.handle;
      const fileData = await fileHandle.getFile();
      
      // Stop current audio if playing
      audioRef.current.pause();
      
      // Create object URL for audio playback
      const audioUrl = URL.createObjectURL(fileData);
      audioRef.current.src = audioUrl;
      
      setSelectedFile(file);
      setIsPlaying(false);
      setCurrentTime(0);
      
      // Start transcription
      transcribeAudio(fileData);
      
      return () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('Error loading audio file:', error);
    }
  };

  // Transcribe audio using Whisper.js
  const transcribeAudio = async (fileData: File) => {
    if (!transciberRef.current) {
      setTranscript('Error: Transcription model not initialized');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionProgress(0);
    setTranscript('');

    try {
      const result = await transciberRef.current(fileData);
      setTranscript(result.text);
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscript('Error transcribing file');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Playback controls
  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Group files by year and month
  const groupedFiles = files.reduce<GroupedFiles>((acc, file) => {
    const yearKey = file.year;
    const monthKey = `${file.year}-${file.month}`;
    
    if (!acc[yearKey]) {
      acc[yearKey] = {};
    }
    if (!acc[yearKey][monthKey]) {
      acc[yearKey][monthKey] = [];
    }
    
    acc[yearKey][monthKey].push(file);
    return acc;
  }, {});

  return (
    <div className="p-4 flex h-screen">
      <div className="w-1/2 pr-4 overflow-y-auto">
        <Card className="mb-4">
          <CardContent className="p-4">
            <Button 
              onClick={handleFolderSelect}
              className="w-full flex items-center justify-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Select Folder
            </Button>
          </CardContent>
        </Card>

        {Object.entries(groupedFiles).map(([year, months]) => (
          <div key={year} className="mb-6">
            <h2 className="text-xl font-bold mb-2">{year}</h2>
            {Object.entries(months).map(([monthKey, monthFiles]) => (
              <div key={monthKey} className="mb-4">
                <h3 className="text-lg font-semibold mb-2">
                  {new Date(monthKey).toLocaleString('default', { month: 'long' })}
                </h3>
                {monthFiles.map((file) => (
                  <Card 
                    key={file.name}
                    className={`mb-2 cursor-pointer ${
                      selectedFile?.name === file.name ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleFileSelect(file)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <FileAudio className="w-4 h-4" />
                      <div className="flex-1">
                        <div className="font-medium">{file.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {file.time}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="w-1/2 pl-4 flex flex-col">
        {selectedFile && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <Button
                  onClick={togglePlayPause}
                  size="icon"
                  className="w-12 h-12"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[currentTime]}
                    max={duration}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="flex-1">
          <CardContent className="p-4">
            {selectedFile ? (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Transcript
                </h2>
                {isTranscribing ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <RotateCw className="w-4 h-4 animate-spin" />
                      Transcribing...
                    </div>
                    <Progress value={transcriptionProgress} className="w-full" />
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{transcript}</div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                Select a file to view its transcript
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AudioManager;