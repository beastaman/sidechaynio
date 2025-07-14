"use client"

import { useState, useRef, useEffect } from "react"
import {
  Play,
  Pause,
  Volume2,
  RotateCcw,
  Settings,
  Home,
  Search,
  Bookmark,
  Award,
  MoreHorizontal,
  Download,
  Heart,
  Repeat,
  Eye,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

export default function SidechaynMusicPlayer() {
  // ============================================================================
  // AUDIO REFERENCES AND CONTEXT SETUP
  // ============================================================================

  // Core audio elements - these handle the actual audio playback and processing
  const audioRef = useRef<HTMLAudioElement>(null) // Main audio element
  const audioContextRef = useRef<AudioContext | null>(null) // Web Audio API context
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null) // Audio source node
  const gainNodeRef = useRef<GainNode | null>(null) // Volume control node
  const convolverRef = useRef<ConvolverNode | null>(null) // Reverb effect node
  const bassFilterRef = useRef<BiquadFilterNode | null>(null) // Bass EQ filter
  const midFilterRef = useRef<BiquadFilterNode | null>(null) // Mid EQ filter
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null) // Treble EQ filter
  const pitchShifterRef = useRef<ScriptProcessorNode | null>(null) // Pitch shifter node

  // ============================================================================
  // PLAYER STATE MANAGEMENT
  // ============================================================================

  // Basic playback controls
  const [isPlaying, setIsPlaying] = useState(false) // Track if audio is currently playing
  const [currentTime, setCurrentTime] = useState(0) // Current playback position in seconds
  const [duration, setDuration] = useState(0) // Total track duration in seconds
  const [volume, setVolume] = useState([70]) // Master volume (0-100)
  const [isLoading, setIsLoading] = useState(false) // Loading state for UI feedback

  // ============================================================================
  // AUDIO EFFECTS STATE - LIVE TUNING CONTROLS
  // ============================================================================

  // Speed and pitch controls
  const [speed, setSpeed] = useState([1]) // Playback speed multiplier (0.5x - 2x)
  const [pitch, setPitch] = useState([1]) // Pitch adjustment (not implemented in basic version)

  // Reverb and spatial effects
  const [reverb, setReverb] = useState([0]) // Reverb wet/dry mix (0-100%)

  // 3-Band Equalizer controls
  const [bassEQ, setBassEQ] = useState([0]) // Bass frequencies boost/cut (-12 to +12 dB)
  const [midEQ, setMidEQ] = useState([0]) // Mid frequencies boost/cut (-12 to +12 dB)
  const [trebleEQ, setTrebleEQ] = useState([0]) // Treble frequencies boost/cut (-12 to +12 dB)

  // Special Sidechayn feature
  const [trueFidelityMode, setTrueFidelityMode] = useState(false) // Enhanced audio processing

  // ============================================================================
  // DEMO TRACK INFORMATION - MATCHING SIDECHAYN DESIGN
  // ============================================================================

  const trackInfo = {
    title: "Epic Soundtrack No. 6 | Live Like Today Is Your Last Day", // Track title from Sidechayn design
    artist: "VOS_Studio", // Artist name from design
    uploadTime: "Uploaded 5 days ago", // Upload timestamp
    stats: {
      plays: "55K", // Play count
      likes: "1K", // Like count
      reposts: "1K", // Repost count
      comments: "2K", // Comment count
      downloads: "1K", // Download count
    },
  }

  // ============================================================================
  // WEB AUDIO API INITIALIZATION
  // ============================================================================

  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl) return

    // This function sets up the entire audio processing chain
    const initializeAudioContext = () => {
      if (!audioContextRef.current) {
        // Create audio context - this is the foundation of Web Audio API
        // @ts-expect-error - Safari support for webkitAudioContext
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioCtx()
        audioContextRef.current = ctx

        // Create the audio source from our HTML audio element
        const sourceNode = ctx.createMediaElementSource(audioEl)
        sourceRef.current = sourceNode

        // ====================================================================
        // AUDIO PROCESSING CHAIN SETUP
        // ====================================================================

        // Create all the audio processing nodes
        gainNodeRef.current = ctx.createGain() // Master volume control
        convolverRef.current = ctx.createConvolver() // Reverb effect

        // Create separate EQ filters for bass, mid, and treble
        bassFilterRef.current = ctx.createBiquadFilter()
        midFilterRef.current = ctx.createBiquadFilter()
        trebleFilterRef.current = ctx.createBiquadFilter()

        // Configure EQ filters with appropriate frequency ranges
        // Bass filter: Low-shelf filter affecting frequencies below 200Hz
        bassFilterRef.current.type = "lowshelf"
        bassFilterRef.current.frequency.value = 200

        // Mid filter: Peaking filter centered at 1000Hz (vocal range)
        midFilterRef.current.type = "peaking"
        midFilterRef.current.frequency.value = 1000
        midFilterRef.current.Q.value = 1 // Bandwidth control

        // Treble filter: High-shelf filter affecting frequencies above 3000Hz
        trebleFilterRef.current.type = "highshelf"
        trebleFilterRef.current.frequency.value = 3000

        // ====================================================================
        // CONNECT THE AUDIO PROCESSING CHAIN
        // ====================================================================

        // Create pitch shifter node
        const bufferSize = 4096;
        pitchShifterRef.current = ctx.createScriptProcessor(bufferSize, 1, 1);
        
        // Audio flow: Source -> Pitch -> Bass EQ -> Mid EQ -> Treble EQ -> Volume -> Reverb -> Output
        sourceNode.connect(pitchShifterRef.current)
        pitchShifterRef.current.connect(bassFilterRef.current)
        bassFilterRef.current.connect(midFilterRef.current)
        midFilterRef.current.connect(trebleFilterRef.current)
        trebleFilterRef.current.connect(gainNodeRef.current)
        gainNodeRef.current.connect(convolverRef.current)
        convolverRef.current.connect(ctx.destination) // Final output to speakers

        // Initialize pitch shifting
        let pitchRatio = 1.0;
        const grainSize = bufferSize * 2;
        let phase = 0;
        const lastInputBuffer = new Float32Array(grainSize);

        pitchShifterRef.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const outputData = e.outputBuffer.getChannelData(0);
          
          // Update pitch ratio based on current pitch value
          pitchRatio = pitch[0];
          
          // Simple pitch shifting using granular synthesis
          for (let i = 0; i < inputData.length; i++) {
            // Read input with linear interpolation
            const readPos = phase + i * pitchRatio;
            const readIndex = Math.floor(readPos);
            const alpha = readPos - readIndex;
            
            const sample1 = readIndex < inputData.length ? inputData[readIndex] : lastInputBuffer[readIndex - inputData.length];
            const sample2 = readIndex + 1 < inputData.length ? inputData[readIndex + 1] : lastInputBuffer[readIndex + 1 - inputData.length];
            
            outputData[i] = sample1 + alpha * (sample2 - sample1);
          }
          
          // Update phase and store last buffer
          phase = (phase + inputData.length * pitchRatio) % grainSize;
          lastInputBuffer.set(inputData);
        };

        // Generate reverb impulse response for realistic reverb effect
        createReverbImpulse()
      }
    }

    // Initialize audio context when metadata is loaded (ensures audio file is ready)
    audioEl.addEventListener("loadedmetadata", initializeAudioContext)

    // Cleanup function to remove event listener
    return () => audioEl.removeEventListener("loadedmetadata", initializeAudioContext)
  }, [pitch])

  // ============================================================================
  // REVERB IMPULSE RESPONSE GENERATION
  // ============================================================================

  const createReverbImpulse = () => {
    if (!audioContextRef.current || !convolverRef.current) return

    // Create artificial reverb by generating noise that decays over time
    const sampleRate = audioContextRef.current.sampleRate
    const length = sampleRate * 2 // 2 seconds of reverb tail
    const impulse = audioContextRef.current.createBuffer(2, length, sampleRate)

    // Generate decaying noise for both stereo channels
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        // Create random noise that decays exponentially
        const decay = Math.pow(1 - i / length, 2) // Exponential decay curve
        channelData[i] = (Math.random() * 2 - 1) * decay
      }
    }

    // Apply the impulse response to the convolver
    convolverRef.current.buffer = impulse
  }

  // ============================================================================
  // REAL-TIME AUDIO EFFECTS APPLICATION
  // ============================================================================

  useEffect(() => {
    // Apply speed changes (affects tempo only when pitch shifting is active)
    if (audioRef.current) {
      if (pitch[0] === 1) {
        // When no pitch shift, speed affects both tempo and pitch naturally
        audioRef.current.playbackRate = speed[0];
      } else {
        // When pitch shifting is active, speed only affects tempo
        audioRef.current.playbackRate = speed[0] / pitch[0];
      }
    }

    // Apply master volume control
    if (gainNodeRef.current) {
      // Convert percentage to linear gain (0-1 range)
      gainNodeRef.current.gain.value = volume[0] / 100
    }

    // Apply EQ settings to each frequency band
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.value = bassEQ[0] // Bass boost/cut in dB
    }

    if (midFilterRef.current) {
      midFilterRef.current.gain.value = midEQ[0] // Mid boost/cut in dB
    }

    if (trebleFilterRef.current) {
      trebleFilterRef.current.gain.value = trebleEQ[0] // Treble boost/cut in dB
    }

    // Apply reverb effect (simplified implementation)
    // In a full implementation, you'd create a wet/dry mix
    if (convolverRef.current && audioContextRef.current) {
      // Apply reverb wet/dry mix
      if (gainNodeRef.current && convolverRef.current && audioContextRef.current) {
        if (reverb[0] === 0) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current.connect(audioContextRef.current.destination);
        } else {
          gainNodeRef.current.disconnect();
          gainNodeRef.current.connect(convolverRef.current);
        }
      }
    }
  }, [speed, volume, bassEQ, midEQ, trebleEQ, reverb, pitch]) // Re-run when any effect changes

  // ============================================================================
  // PLAYBACK CONTROL FUNCTIONS
  // ============================================================================

  const togglePlayPause = async () => {
    if (!audioRef.current) return

    setIsLoading(true)

    try {
      // Resume audio context if it's suspended (browser autoplay policy)
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume()
      }

      if (isPlaying) {
        // Pause the audio
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        // Start playing the audio
        await audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error("Playback error:", error)
      // Handle playback errors gracefully
      setIsPlaying(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset all audio effects to their default values
  const resetEffects = () => {
    setSpeed([1]) // Normal speed
    setPitch([1]) // Normal pitch
    setReverb([0]) // No reverb
    setBassEQ([0]) // Flat bass
    setMidEQ([0]) // Flat mids
    setTrebleEQ([0]) // Flat treble
    setVolume([70]) // 70% volume
    setTrueFidelityMode(false) // Disable special mode
  }

  // ============================================================================
  // AUDIO EVENT HANDLERS
  // ============================================================================

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // Format time in MM:SS format
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Calculate progress percentage for visual indicators
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  // ============================================================================
  // MAIN COMPONENT RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ====================================================================== */}
      {/* HIDDEN AUDIO ELEMENT - THE ACTUAL AUDIO PLAYER */}
      {/* ====================================================================== */}
      <audio
        ref={audioRef}
        src="/audio/demo-track.mp3" // PUT YOUR DOWNLOADED TRACK HERE
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata" // Load metadata but not the full file initially
      />

      {/* ====================================================================== */}
      {/* BETA NOTIFICATION BAR - MATCHING SIDECHAYN DESIGN */}
      {/* ====================================================================== */}
      <div className="bg-blue-600 text-white text-center py-2 text-sm px-4">
        <span className="hidden sm:inline">FYI - Sidechayn is still in beta development and has not yet been publically released. See Progress!</span>
        <span className="sm:hidden">Sidechayn Beta - See Progress!</span>
      </div>

      <div className="flex flex-col lg:flex-row min-h-screen pb-20 lg:pb-0">
        {/* ================================================================== */}
        {/* LEFT SIDEBAR - NAVIGATION MATCHING SIDECHAYN LAYOUT */}
        {/* ================================================================== */}
        <div className="hidden lg:flex lg:w-64 bg-gray-900 p-4 flex-col shrink-0">
          {/* Sidechayn Logo */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Sidechayn.com</h1>
          </div>

          {/* Register/Login Button - Matching Sidechayn Blue */}
          <Button className="bg-blue-600 hover:bg-blue-700 text-white mb-6 rounded-full">
            <div className="text-center">
              <div>Register / Log In</div>
              <div className="text-xs text-blue-200">Join 12k New User This Week!</div>
            </div>
          </Button>

          {/* Navigation Menu */}
          <nav className="space-y-2 flex-1">
            <Button variant="ghost" className="w-full justify-start bg-blue-600/20 text-white">
              <Home className="mr-3 h-4 w-4" />
              Home
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white">
              <Search className="mr-3 h-4 w-4" />
              Explore
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white">
              <Bookmark className="mr-3 h-4 w-4" />
              Saved Tracks
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white">
              <Award className="mr-3 h-4 w-4" />
              Achievements
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white">
              <Settings className="mr-3 h-4 w-4" />
              Settings
            </Button>
          </nav>

          {/* Beta Notice */}
          <div className="mt-auto">
            <div className="bg-gray-800 p-3 rounded-lg">
              <h4 className="font-bold text-white mb-1">READ THIS !</h4>
              <p className="text-xs text-gray-300">
                Sidechayn is still in beta development and has not yet been publically released.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                You're one of the first 1 million users to sign up before launch!
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* MOBILE HEADER - ONLY VISIBLE ON SMALL SCREENS */}
        {/* ================================================================== */}
        <div className="lg:hidden bg-gray-900 px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Sidechayn.com</h1>
          <Button variant="ghost" size="sm" className="text-white">
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* ================================================================== */}
        {/* MAIN CONTENT AREA */}
        {/* ================================================================== */}
        <div className="flex-1 flex flex-col xl:flex-row min-h-0">
          {/* ================================================================ */}
          {/* CENTER - MAIN PLAYER AREA */}
          {/* ================================================================ */}
          <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
            {/* TrueFidelity Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <span className="text-white font-medium">TrueFidelity&reg; Mode?</span>
                <Switch checked={trueFidelityMode} onCheckedChange={setTrueFidelityMode} />
                <span className="text-gray-400">{trueFidelityMode ? "ON" : "OFF"}</span>
              </div>
            </div>

            {/* Main Track Player Card */}
            <Card className="bg-gray-900 border-gray-700 mb-6">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    {/* Artist Avatar */}
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-white font-bold">JW</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-white text-lg lg:text-xl truncate">{trackInfo.title}</CardTitle>
                      <p className="text-gray-300 truncate">{trackInfo.artist}</p>
                      <p className="text-gray-500 text-sm">{trackInfo.uploadTime}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Waveform Visualization Area */}
                <div className="h-24 sm:h-32 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg flex items-center justify-center border border-gray-700 relative overflow-hidden">
                  {/* Animated Waveform Bars */}
                  <div className="flex items-center space-x-1 absolute inset-0 justify-center">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        className={`bg-blue-400 rounded-full transition-all duration-300 ${
                          isPlaying ? "animate-pulse" : ""
                        }`}
                        style={{
                          width: "2px",
                          height: `${Math.random() * 60 + 10}px`,
                          animationDelay: `${i * 0.05}s`,
                          opacity: i < (progressPercentage / 100) * 40 ? 1 : 0.3,
                        }}
                      />
                    ))}
                  </div>

                  {/* Progress Overlay */}
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-600/10 transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Progress Bar and Time Display */}
                <div className="space-y-2">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Main Playback Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                  {/* Play/Pause Button */}
                  <Button
                    onClick={togglePlayPause}
                    disabled={isLoading}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-16 h-16 shrink-0"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    ) : isPlaying ? (
                      <Pause size={24} />
                    ) : (
                      <Play size={24} />
                    )}
                  </Button>

                  {/* Volume Control */}
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <Volume2 className="text-white shrink-0" size={20} />
                    <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="flex-1 sm:w-24" />
                    <span className="text-white text-sm w-8 shrink-0">{volume[0]}</span>
                  </div>

                  {/* Reset Effects Button */}
                  <Button
                    onClick={resetEffects}
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent shrink-0"
                  >
                    <RotateCcw size={16} className="mr-1" />
                    Reset
                  </Button>
                </div>

                {/* Track Stats - Matching Sidechayn Design */}
                <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-6 pt-4 border-t border-gray-700">
                  <div className="flex items-center space-x-1 text-gray-400">
                    <span className="text-white font-bold">{trackInfo.stats.plays}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-400">
                    <Heart size={16} />
                    <span className="text-white">{trackInfo.stats.likes}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-400">
                    <Repeat size={16} />
                    <span className="text-white">{trackInfo.stats.reposts}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-400">
                    <Eye size={16} />
                    <span className="text-white">{trackInfo.stats.comments}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-400">
                    <Plus size={16} />
                    <span className="text-white">{trackInfo.stats.downloads}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ============================================================== */}
            {/* LIVE AUDIO EFFECTS PANEL - THE CORE FEATURE */}
            {/* ============================================================== */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Settings className="mr-2" size={20} />
                  Live Audio Effects - Real-Time Tuning
                </CardTitle>
                <p className="text-gray-400 text-sm">
                  Adjust these controls while the track is playing to hear changes in real-time
                </p>
              </CardHeader>

              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                {/* Speed Control */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-white font-medium">Playback Speed</label>
                    <Badge variant="outline" className="text-blue-400 border-blue-400">
                      {speed[0].toFixed(2)}x
                    </Badge>
                  </div>
                  <Slider value={speed} onValueChange={setSpeed} min={0.5} max={2} step={0.1} className="w-full" />
                  <p className="text-xs text-gray-500">Controls playback tempo and pitch together</p>
                </div>

                {/* Pitch Control */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-white font-medium">Pitch Shift</label>
                    <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                      {pitch[0] > 1 ? "+" : ""}{((pitch[0] - 1) * 12).toFixed(1)} semitones
                    </Badge>
                  </div>
                  <Slider value={pitch} onValueChange={setPitch} min={0.5} max={2} step={0.1} className="w-full" />
                  <p className="text-xs text-gray-500">Independent pitch control (experimental)</p>
                </div>

                {/* Reverb Control */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-white font-medium">Reverb</label>
                    <Badge variant="outline" className="text-purple-400 border-purple-400">
                      {reverb[0]}%
                    </Badge>
                  </div>
                  <Slider value={reverb} onValueChange={setReverb} min={0} max={100} step={5} className="w-full" />
                  <p className="text-xs text-gray-500">Adds spatial depth and echo to the sound</p>
                </div>

                {/* Bass EQ */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-white font-medium">Bass EQ</label>
                    <Badge variant="outline" className="text-red-400 border-red-400">
                      {bassEQ[0] > 0 ? "+" : ""}
                      {bassEQ[0]}dB
                    </Badge>
                  </div>
                  <Slider value={bassEQ} onValueChange={setBassEQ} min={-12} max={12} step={1} className="w-full" />
                  <p className="text-xs text-gray-500">Boost or cut low frequencies (20Hz - 200Hz)</p>
                </div>

                {/* Mid EQ */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-white font-medium">Mid EQ</label>
                    <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                      {midEQ[0] > 0 ? "+" : ""}
                      {midEQ[0]}dB
                    </Badge>
                  </div>
                  <Slider value={midEQ} onValueChange={setMidEQ} min={-12} max={12} step={1} className="w-full" />
                  <p className="text-xs text-gray-500">Adjust vocal and instrument presence (200Hz - 3kHz)</p>
                </div>

                {/* Treble EQ */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-white font-medium">Treble EQ</label>
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      {trebleEQ[0] > 0 ? "+" : ""}
                      {trebleEQ[0]}dB
                    </Badge>
                  </div>
                  <Slider value={trebleEQ} onValueChange={setTrebleEQ} min={-12} max={12} step={1} className="w-full" />
                  <p className="text-xs text-gray-500">Control brightness and clarity (3kHz - 20kHz)</p>
                </div>

                {/* Master Volume */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-white font-medium">Master Volume</label>
                    <Badge variant="outline" className="text-white border-gray-400">
                      {volume[0]}%
                    </Badge>
                  </div>
                  <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={1} className="w-full" />
                  <p className="text-xs text-gray-500">Overall output level control</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ================================================================ */}
          {/* RIGHT SIDEBAR - UP NEXT & UNIQUE FEATURE */}
          {/* ================================================================ */}
          <div className="xl:w-80 p-4 lg:p-6 space-y-6 bg-gray-950/50 overflow-y-auto">
            {/* Up Next Section */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Up Next</h3>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg">
                    <div className="w-12 h-12 bg-gray-600 rounded shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">Blah black out</p>
                      <p className="text-gray-400 text-sm truncate">Drake • 🔥 Trending</p>
                      <p className="text-gray-500 text-xs">EDM music</p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="link" className="text-blue-400 mt-3">
                See more...
              </Button>
            </div>

            {/* ============================================================== */}
            {/* UNIQUE SOUNDCLOUD FEATURE IDEA */}
            {/* ============================================================== */}
            <Card className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-500/30">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center">💡 Unique Feature Idea</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h4 className="text-green-400 font-bold text-lg">Collaborative Live Remix Rooms</h4>

                  <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
                    <p>
                      <strong className="text-white">The Problem:</strong> SoundCloud users can only listen to tracks
                      passively. There is no way to collaborate on remixing or experience music together in real-time.
                    </p>

                    <p>
                      <strong className="text-white">The Solution:</strong> Multi-user live remix sessions where friends
                      can join a Remix Room and collaboratively control different audio effects while listening to the
                      same track simultaneously.
                    </p>

                    <div className="bg-gray-800/50 p-3 rounded-lg">
                      <p className="text-white font-medium mb-2">How it works:</p>
                      <ul className="space-y-1 text-xs">
                        <li>&bull; Host creates a remix room for any track</li>
                        <li>&bull; Friends join via invite link</li>
                        <li>&bull; Each person controls different effects (EQ, reverb, filters)</li>
                        <li>&bull; Changes sync in real-time for all participants</li>
                        <li>&bull; Save and share the collaborative remix</li>
                      </ul>
                    </div>

                    <p>
                      <strong className="text-white">Why users would love it:</strong> Turns passive listening into
                      active social creation. Perfect for DJs, producers, and music enthusiasts who want to experiment
                      together and create unique versions of their favorite tracks.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      Social
                    </Badge>
                    <Badge variant="outline" className="text-blue-400 border-blue-400">
                      Real-time
                    </Badge>
                    <Badge variant="outline" className="text-purple-400 border-purple-400">
                      Collaborative
                    </Badge>
                    <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                      Creative
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Controls */}
            <div className="space-y-3">
              <Button className="w-full bg-gray-700 hover:bg-gray-600 text-white">Add To Queue</Button>
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">
                  Synchasm
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">
                  Onyx Wave
                </Button>
                <Button size="sm" className="bg-gray-600 hover:bg-gray-500 text-xs">
                  Future Bass
                </Button>
              </div>
              <p className="text-right text-gray-400 text-sm">My Playlist 1</p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MOBILE BOTTOM NAVIGATION - ONLY VISIBLE ON SMALL SCREENS */}
      {/* ================================================================== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4">
        <div className="flex items-center justify-around">
          <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 text-white">
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 text-gray-400">
            <Search className="h-5 w-5" />
            <span className="text-xs">Explore</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 text-gray-400">
            <Bookmark className="h-5 w-5" />
            <span className="text-xs">Saved</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 text-gray-400">
            <Award className="h-5 w-5" />
            <span className="text-xs">Awards</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
