import { useState, useEffect } from "react";
import { MapPin, Phone, Map } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";
import { StarRating } from "@/components/common/StarRating";
import { doctorService, DoctorProfile } from "@/services/doctorService";

export function DoctorSearchPage() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [useFallback, setUseFallback] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  useEffect(() => {
    // Only attempt geolocation on initial mount if not using fallback
    if (!useFallback) {
      if (!navigator.geolocation) {
        setUseFallback(true);
        setIsLocating(false);
        return;
      }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchNearbyDoctors(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          console.warn("Geolocation Error:", err);
          setUseFallback(true);
          setIsLocating(false);
        }
      );
    }
  }, [useFallback]);

  const fetchNearbyDoctors = async (lat: number, lng: number) => {
    setIsLocating(false);
    setIsLoading(true);
    setError(null);
    try {
      const data = await doctorService.getNearbyDoctors(lat, lng);
      setDoctors(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load nearby doctors.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress) return;

    setIsLoading(true);
    setError(null);
    try {
      // Direct Nominatim geocoding from frontend for fallback
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualAddress)}&format=json&limit=1`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.length > 0) {
        fetchNearbyDoctors(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        setError("Location not found. Try entering a more specific city or area.");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Error geocoding location.");
      setIsLoading(false);
    }
  };

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Find Nearest Specialist" />

      <div className="p-4 sm:p-6 space-y-6">

        {isLocating ? (
          <div className="py-12 text-center text-primary flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="font-semibold">Getting your live location...</p>
          </div>
        ) : useFallback && doctors.length === 0 && !isLoading ? (
          <form onSubmit={handleManualSearch} className="space-y-4">
            <div className="bg-primary/10 text-primary p-4 rounded-md text-sm mb-4">
              <span className="font-bold flex items-center gap-1"><Map className="w-4 h-4" /> Location access denied or unavailable.</span>
              Please enter your city/area manually to find doctors near you.
            </div>
            <Input
              placeholder="e.g. Kathmandu, Biratnagar, Baneshwor"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              leftIcon={<MapPin className="h-4 w-4" />}
            />
            <Button type="submit" className="w-full">Find Doctors Near Me</Button>
          </form>
        ) : null}

        {error && (
          <div className="py-12 text-center text-destructive">
            <p className="font-semibold">{error}</p>
            {useFallback && (
              <Button onClick={() => setError(null)} className="mt-4" variant="outline">
                Try Another Location
              </Button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4 flex gap-4 animate-pulse">
                  <div className="h-20 w-20 rounded-lg bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/3 bg-muted rounded" />
                    <div className="h-4 w-1/4 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          !isLocating && !error && doctors.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-foreground font-semibold px-1">Doctors Near You</h3>
              {doctors.map((doctor) => (
                <Card key={doctor.id} className="overflow-hidden hover:border-primary/40 transition-colors">
                  <CardContent className="p-0">
                    <div className="flex p-4">
                      <div className="ml-2 flex-1">
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
                        {doctor.address && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{doctor.address}
                          </p>
                        )}

                        <div className="mt-2 flex items-center text-xs text-muted-foreground gap-4">
                          <StarRating rating={doctor.rating} />
                          <span className="flex items-center gap-1 text-primary">
                            <MapPin className="h-3 w-3" /> {doctor.distanceKm} km away
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Only tappable call button — no routes to deleted pages */}
                    {doctor.phone && (
                      <div className="border-t">
                        <a
                          href={`tel:${doctor.phone}`}
                          className="flex justify-center items-center h-11 text-xs font-semibold text-primary hover:bg-primary/5"
                        >
                          <Phone className="h-4 w-4 mr-1.5" /> Call {doctor.phone}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </PageTransition>
  );
}
