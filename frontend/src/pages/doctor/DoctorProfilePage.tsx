import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, Phone, MessageSquare, Calendar, ChevronLeft, Award, Users, Clock, ShieldCheck } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";
import { StarRating } from "@/components/common/StarRating";
import { doctorService, DoctorProfile } from "@/services/doctorService";
import { ROUTES } from "@/constants/routes";

export function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDoctorDetail() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await doctorService.getDoctorDetail(id);
        setDoctor(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load doctor profile. It may not exist.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDoctorDetail();
  }, [id]);

  if (isLoading) {
    return (
      <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20">
        <Header title="Doctor Profile" showBack />
        <div className="p-4 sm:p-6 space-y-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-1/2 bg-muted rounded" />
              <div className="h-4 w-1/3 bg-muted rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-20 bg-muted rounded-xl" />
            <div className="h-20 bg-muted rounded-xl" />
            <div className="h-20 bg-muted rounded-xl" />
          </div>
          <div className="h-32 bg-muted rounded-xl" />
        </div>
      </PageTransition>
    );
  }

  if (error || !doctor) {
    return (
      <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 justify-center items-center">
        <p className="text-destructive font-semibold">{error || "Doctor not found."}</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </PageTransition>
    );
  }

  return (
    <PageTransition variant="slide" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title={doctor.name} showBack />

      <div className="p-4 sm:p-6 space-y-6 max-w-lg mx-auto w-full">
        {/* Profile Card Header */}
        <div className="flex items-start gap-4">
          <img
            src={doctor.imageUrl}
            alt={doctor.name}
            className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-cover border bg-muted shadow-sm"
          />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="flex items-center justify-between gap-2 wrap">
              <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{doctor.name}</h2>
              {doctor.isAvailable ? (
                <Badge variant="success" className="text-[10px] shrink-0">Available</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">Busy</Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-primary">{doctor.specialty}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {doctor.hospital} ({doctor.distance})
            </p>
            <div className="pt-1">
              <StarRating rating={doctor.rating} size={15} />
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border border-border/80">
            <CardContent className="p-3 text-center flex flex-col justify-center items-center space-y-1">
              <Award className="h-5 w-5 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">Experience</span>
              <span className="text-sm font-bold text-foreground">{doctor.experience}+ Yrs</span>
            </CardContent>
          </Card>
          <Card className="border border-border/80">
            <CardContent className="p-3 text-center flex flex-col justify-center items-center space-y-1">
              <Users className="h-5 w-5 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Patients</span>
              <span className="text-sm font-bold text-foreground">{doctor.patientsCount}+</span>
            </CardContent>
          </Card>
          <Card className="border border-border/80">
            <CardContent className="p-3 text-center flex flex-col justify-center items-center space-y-1">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Response</span>
              <span className="text-sm font-bold text-foreground">{doctor.responseTime}</span>
            </CardContent>
          </Card>
        </div>

        {/* Biography Block */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> Biography
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {doctor.bio}
          </p>
        </div>

        {/* Reviews Section Mock */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">Recent Patient Feedback</p>
          <Card className="bg-muted/30 border-none shadow-none">
            <CardContent className="p-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground">Priya K.</span>
                <span className="text-muted-foreground">July 10, 2026</span>
              </div>
              <div className="flex items-center gap-1">
                <StarRating rating={5.0} size={12} className="!gap-0" />
              </div>
              <p className="text-xs text-muted-foreground italic leading-normal">
                "Very attentive therapist. Helped check my squat angle deviations after the postural analysis, giving highly customized feedback. Highly recommend!"
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Actions Bar */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link to={ROUTES.DOCTOR_CALL(doctor.id)} className="w-full">
            <Button variant="outline" className="w-full h-12 flex items-center justify-center gap-2 border bg-card hover:bg-muted/10">
              <Phone className="h-4 w-4" /> Call Doctor
            </Button>
          </Link>
          <Link to={ROUTES.DOCTOR_CHAT(doctor.id)} className="w-full">
            <Button variant="outline" className="w-full h-12 flex items-center justify-center gap-2 border bg-card hover:bg-muted/10">
              <MessageSquare className="h-4 w-4" /> Message
            </Button>
          </Link>
          <Link to={ROUTES.DOCTOR_BOOK(doctor.id)} className="col-span-2 w-full mt-1">
            <Button className="w-full h-12 shadow-md flex items-center justify-center gap-2">
              <Calendar className="h-4.5 w-4.5" /> Book Appointment
            </Button>
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
