import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { doctorService, DoctorProfile } from "@/services/doctorService";

export function DoctorCallPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);

  // Calls States
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    async function fetchDoctor() {
      if (!id) return;
      try {
        const data = await doctorService.getDoctorDetail(id);
        setDoctor(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchDoctor();
  }, [id]);

  // Duration Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const handleEndCall = () => {
    navigate(-1);
  };

  if (!doctor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <PageTransition
      variant="fade"
      className="flex flex-col justify-between items-center h-screen w-full max-w-lg mx-auto bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white p-6 relative overflow-hidden"
    >
      {/* Encryption Banner */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] text-white/60 font-semibold tracking-wide mt-4 z-10 backdrop-blur-md">
        <ShieldAlert className="h-3 w-3 text-emerald-500" /> END-TO-END ENCRYPTED CONSULTATION
      </div>

      {/* Doctor Meta & Ripple Avatar */}
      <div className="flex flex-col items-center justify-center space-y-4 my-auto relative z-10">
        <div className="relative flex items-center justify-center">
          {/* Ripple Pulse Rings */}
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75 w-28 h-28" />
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse w-36 h-36" />
          
          <img
            src={doctor.imageUrl}
            alt={doctor.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-white/20 shadow-2xl relative z-10 bg-slate-800"
          />
        </div>

        <div className="text-center space-y-1 z-10">
          <h2 className="text-lg font-bold tracking-tight">{doctor.name}</h2>
          <p className="text-xs text-white/60 font-semibold">{doctor.specialty}</p>
        </div>

        <p className="text-sm font-semibold tracking-widest text-emerald-400 font-mono mt-2 z-10">
          {formatTimer(callDuration)}
        </p>
      </div>

      {/* Control Bar Actions Panel */}
      <div className="w-full space-y-6 mb-8 z-10">
        <div className="flex items-center justify-center gap-4 bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-xl max-w-sm mx-auto shadow-2xl">
          {/* Mute Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-200 ${
              isAudioMuted
                ? "bg-white text-slate-900 border-white hover:bg-white/90"
                : "bg-white/10 text-white border-white/10 hover:bg-white/20"
            }`}
          >
            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          {/* Video Toggle Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsVideoMuted(!isVideoMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-200 ${
              isVideoMuted
                ? "bg-white text-slate-900 border-white hover:bg-white/90"
                : "bg-white/10 text-white border-white/10 hover:bg-white/20"
            }`}
          >
            {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>

          {/* Speaker Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 text-white border border-white/10 hover:bg-white/20"
          >
            <Volume2 className="h-5 w-5" />
          </Button>

          {/* End Call Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleEndCall}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-rose-600 text-white border border-rose-500/20 hover:bg-rose-500 animate-pulse shadow-lg"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
