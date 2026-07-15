import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Send, Phone, ArrowLeft, MoreVertical, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { doctorService, DoctorProfile, Message } from "@/services/doctorService";
import { ROUTES } from "@/constants/routes";

export function DoctorChatPage() {
  const { id } = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Doctor details
  useEffect(() => {
    async function fetchDoctor() {
      if (!id) return;
      try {
        const data = await doctorService.getDoctorDetail(id!);
        setDoctor(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchDoctor();
  }, [id]);

  // Fetch & Poll Messages
  useEffect(() => {
    if (!id) return;

    async function fetchMessages() {
      try {
        const data = await doctorService.getMessages(id!);
        // Avoid resetting state if length is identical
        setMessages((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      } catch (err) {
        console.error(err);
      }
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll messages every 3s

    return () => clearInterval(interval);
  }, [id]);

  // Auto Scroll to latest messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    // Optimistic user bubble update
    const optimisticMessage: Message = {
      id: Date.now(),
      sender: 0,
      senderName: "Me",
      doctor: Number(id),
      doctorName: doctor?.name || "",
      content: messageText,
      timestamp: new Date().toISOString(),
      isFromDoctor: false,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await doctorService.sendMessage(id!, messageText);
      // Let the polling system naturally fetch the doctor's immediate trigger reply 
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  if (!doctor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <PageTransition variant="slide" className="flex flex-col h-screen max-w-lg mx-auto bg-background">
      {/* Custom Chat Header */}
      <header className="flex h-16 w-full items-center justify-between border-b bg-card px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to={ROUTES.DOCTOR_DETAIL(doctor.id)} className="text-foreground/80 hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="relative">
            <img
              src={doctor.imageUrl}
              alt={doctor.name}
              className="h-10 w-10 rounded-full object-cover border"
            />
            {doctor.isAvailable && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground truncate max-w-[150px]">
              {doctor.name}
            </h1>
            <p className="text-[10px] text-emerald-500 font-semibold">Online</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link to={ROUTES.DOCTOR_CALL(doctor.id)}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <Phone className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Messages Thread list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
        <div className="text-center py-2 flex flex-col items-center">
          <span className="text-[10px] bg-card px-2.5 py-1 rounded-full border text-muted-foreground font-semibold flex items-center gap-1 shadow-sm">
            <Sparkles className="h-3 w-3 text-primary animate-pulse" /> Secure AECS Consultation channel
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
            <p className="text-sm text-foreground/80 font-bold">Start your consultation</p>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              Ask {doctor.name} about your exercises, posture scan results, or joint angle deviations.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const timeObj = new Date(message.timestamp);
            const timeString = isNaN(timeObj.getTime())
              ? "Just now"
              : timeObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

            return (
              <div
                key={message.id}
                className={`flex w-full ${message.isFromDoctor ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl p-3 text-xs shadow-sm leading-relaxed ${
                    message.isFromDoctor
                      ? "bg-card text-foreground rounded-tl-none border border-border/60"
                      : "bg-primary text-primary-foreground rounded-tr-none shadow-button"
                  }`}
                >
                  <p>{message.content}</p>
                  <span
                    className={`block text-[9px] mt-1 text-right font-medium ${
                      message.isFromDoctor ? "text-muted-foreground" : "text-primary-foreground/75"
                    }`}
                  >
                    {timeString}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Send Input Box */}
      <form onSubmit={handleSendMessage} className="p-3 border-t bg-card flex gap-2 items-center">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={`Message ${doctor.name}...`}
          className="flex-1 h-10 px-4 rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary text-xs text-foreground"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!newMessage.trim() || isSending}
          className="h-10 w-10 shrink-0 rounded-xl shadow-button flex items-center justify-center"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </PageTransition>
  );
}
