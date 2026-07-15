import { useState, useEffect } from "react";
import { Search, MapPin, Video, Phone, ChevronRight, UserPlus2, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";
import { StarRating } from "@/components/common/StarRating";
import { doctorService, DoctorProfile } from "@/services/doctorService";
import { ROUTES } from "@/constants/routes";

const SPECIALTIES = ["All", "Physical Therapist", "Sports Medicine", "Orthopedic", "Cardiology"];

export function DoctorSearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDoctors() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await doctorService.getDoctors(
          selectedSpecialty,
          searchQuery
        );
        setDoctors(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load doctors. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    const timer = setTimeout(() => {
      fetchDoctors();
    }, 300); // Debouncing search query

    return () => clearTimeout(timer);
  }, [selectedSpecialty, searchQuery]);

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Find a Specialist" />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Search Input */}
        <Input
          placeholder="Search doctors or specialties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SPECIALTIES.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all duration-150 ${
                selectedSpecialty === spec
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/50 text-foreground"
              }`}
            >
              {spec}
            </button>
          ))}
        </div>

        {/* Doctor List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4 flex gap-4 animate-pulse">
                  <div className="h-20 w-20 rounded-lg bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/3 bg-muted rounded" />
                    <div className="h-4 w-1/4 bg-muted rounded" />
                    <div className="h-4 w-1/2 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center text-destructive">
            <p className="font-semibold">{error}</p>
            <Button onClick={() => setSelectedSpecialty(selectedSpecialty)} className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map((doctor) => (
              <Card key={doctor.id} className="overflow-hidden hover:border-primary/40 transition-colors">
                <CardContent className="p-0">
                  <Link to={ROUTES.DOCTOR_DETAIL(doctor.id)} className="flex p-4 hover:bg-muted/30 transition-colors">
                    <img
                      src={doctor.imageUrl}
                      alt={doctor.name}
                      className="h-20 w-20 rounded-lg object-cover flex-shrink-0 border bg-muted"
                    />
                    <div className="ml-4 flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-base text-foreground">{doctor.name}</h3>
                          <p className="text-sm text-primary font-medium">{doctor.specialty}</p>
                        </div>
                        {doctor.isAvailable ? (
                          <Badge variant="success" className="text-[10px]">Available</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Busy</Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {doctor.hospital}
                      </p>

                      <div className="mt-2 flex items-center text-xs text-muted-foreground gap-4">
                        <StarRating rating={doctor.rating} />
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {doctor.distance}
                        </span>
                        <span>{doctor.experience} yrs exp</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center pl-2">
                      <ChevronRight className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                  </Link>

                  <div className="grid grid-cols-3 gap-px bg-border/50 border-t">
                    <Link
                      to={ROUTES.DOCTOR_CALL(doctor.id)}
                      className="inline-flex justify-center items-center h-11 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-muted/20 border-r"
                    >
                      <Phone className="h-4 w-4 mr-1.5" /> Call
                    </Link>
                    <Link
                      to={ROUTES.DOCTOR_CHAT(doctor.id)}
                      className="inline-flex justify-center items-center h-11 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-muted/20 border-r"
                    >
                      <Video className="h-4 w-4 mr-1.5" /> Consult
                    </Link>
                    <Link
                      to={ROUTES.DOCTOR_BOOK(doctor.id)}
                      className="inline-flex justify-center items-center h-11 text-xs font-semibold text-primary hover:bg-primary/5 hover:text-primary-hover"
                    >
                      <CalendarDays className="h-4 w-4 mr-1.5" /> Book
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}

            {doctors.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No specialists found matching your search.
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
