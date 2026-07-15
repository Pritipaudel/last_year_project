import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, Clock, CheckCircle2, ChevronRight, AlertCircle, Sparkles } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";
import { WeekdayCalendar } from "@/components/common/WeekdayCalendar";
import { TimeSlotPicker } from "@/components/common/TimeSlotPicker";
import { doctorService, DoctorProfile, AvailabilitySlot, Appointment } from "@/services/doctorService";
import { ROUTES } from "@/constants/routes";
import { useUIStore } from "@/store/uiStore";

export function AppointmentBookingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useUIStore();

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>((() => {
    // Default to tomorrow, if tomorrow is Sunday, default to Monday
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  })());

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [reason, setReason] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingAppts, setIsLoadingAppts] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch doctor detail
  useEffect(() => {
    async function fetchDoctor() {
      if (!id) return;
      setIsLoadingDoc(true);
      try {
        const data = await doctorService.getDoctorDetail(id);
        setDoctor(data);
      } catch (err) {
        console.error(err);
        addToast({ title: "Error", description: "Failed to load doctor profile", type: "error" });
      } finally {
        setIsLoadingDoc(false);
      }
    }
    fetchDoctor();
  }, [id]);

  // Fetch availability when date changes
  useEffect(() => {
    async function fetchSlots() {
      if (!id) return;
      setIsLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const dd = String(selectedDate.getDate()).padStart(2, "0");
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        const data = await doctorService.getAvailability(id, formattedDate);
        setSlots(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [id, selectedDate]);

  // Fetch current appointments helper
  const fetchAppointments = async () => {
    setIsLoadingAppts(true);
    try {
      const data = await doctorService.getAppointments();
      setAppointments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAppts(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleBooking = async () => {
    if (!id || !doctor || !selectedSlot) return;
    setIsBooking(true);
    try {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate.getDate()).padStart(2, "0");
      const formattedDate = `${yyyy}-${mm}-${dd}`;

      await doctorService.bookAppointment(
        id,
        selectedSlot.id,
        formattedDate,
        selectedSlot.formattedTime,
        reason
      );
      
      setShowSuccess(true);
      addToast({ title: "Success", description: "Appointment booked successfully!", type: "success" });
      fetchAppointments();
    } catch (err) {
      console.error(err);
      addToast({ title: "Booking Failed", description: "This slot may have been booked. Select another slot.", type: "error" });
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoadingDoc || !doctor) {
    return (
      <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20">
        <Header title="Book Appointment" showBack />
        <div className="p-4 sm:p-6 space-y-6 animate-pulse">
          <div className="h-12 bg-muted rounded" />
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
        </div>
      </PageTransition>
    );
  }

  // Formatting date string natively for UI
  const formattedSelectedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <PageTransition variant="slide" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Book Appointment" showBack />

      <div className="p-4 sm:p-6 space-y-6 max-w-lg mx-auto w-full">
        {showSuccess ? (
          <Card className="border border-emerald-500/20 bg-emerald-500/5 text-center overflow-hidden">
            <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Appointment Scheduled!</h2>
              <div className="text-sm text-foreground/80 space-y-1">
                <p>You have scheduled a consultation with</p>
                <p className="font-bold text-primary">{doctor.name}</p>
                <p className="font-semibold mt-2">{formattedSelectedDate}</p>
                <p className="font-semibold text-primary">{selectedSlot?.formattedTime}</p>
              </div>
              <div className="pt-4 flex w-full gap-2">
                <Button className="flex-1" onClick={() => setShowSuccess(false)}>
                  Book Another
                </Button>
                <Button variant="outline" className="flex-1 border bg-card" onClick={() => navigate(ROUTES.DASHBOARD)}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Doctor Info Card */}
            <div className="flex gap-4 p-4 border rounded-2xl bg-card">
              <img
                src={doctor.imageUrl}
                alt={doctor.name}
                className="h-16 w-16 rounded-xl object-cover border"
              />
              <div>
                <h3 className="font-bold text-foreground text-sm">{doctor.name}</h3>
                <p className="text-xs text-primary font-semibold">{doctor.specialty}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{doctor.hospital}</p>
              </div>
            </div>

            {/* Date Calendar Picker */}
            <WeekdayCalendar selectedDate={selectedDate} onChange={setSelectedDate} />

            {/* Slots Card Selector */}
            <Card className="border border-border/80">
              <CardContent className="p-4">
                <TimeSlotPicker
                  slots={slots}
                  selectedSlotId={selectedSlot?.id || null}
                  onChange={setSelectedSlot}
                  isLoading={isLoadingSlots}
                />
              </CardContent>
            </Card>

            {/* Reason Field */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground/80">
                Reason for Visit (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your symptoms or physiological goals..."
                className="w-full h-24 p-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
              />
            </div>

            {/* Submit CTA */}
            <Button
              className="w-full h-12 shadow-button font-bold text-sm"
              disabled={!selectedSlot || isBooking}
              onClick={handleBooking}
            >
              {isBooking ? "Confirming Booking..." : "Confirm Appointment"}
            </Button>
          </>
        )}

        {/* Upcoming Appointments */}
        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-500" /> Upcoming Consultations
          </h3>

          {isLoadingAppts ? (
            <div className="h-16 bg-muted rounded-xl animate-pulse" />
          ) : appointments.length === 0 ? (
            <div className="py-6 text-center border rounded-xl border-dashed bg-card text-xs text-muted-foreground">
              You have no scheduled consultations.
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const apptDate = new Date(appt.date);
                const showDateStr = apptDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div key={appt.id} className="p-3 border rounded-xl bg-card flex justify-between items-center text-xs">
                    <div className="flex gap-3 items-center">
                      <img
                        src={appt.doctorDetail?.imageUrl}
                        alt={appt.doctorDetail?.name}
                        className="h-10 w-10 rounded-lg object-cover border"
                      />
                      <div>
                        <p className="font-bold text-foreground">{appt.doctorDetail?.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-semibold">
                          <span className="flex items-center"><Calendar className="h-3 w-3 mr-0.5" /> {showDateStr}</span>
                          <span className="flex items-center"><Clock className="h-3 w-3 mr-0.5" /> {appt.timeSlot}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={appt.status === "confirmed" ? "success" : "outline"} className="text-[9px]">
                      {appt.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
