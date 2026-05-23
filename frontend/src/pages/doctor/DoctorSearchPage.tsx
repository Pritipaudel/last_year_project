import { useState } from "react";
import { Search, MapPin, Star, Phone, Video } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";

const DOCTORS = [
  {
    id: "1",
    name: "Dr. Sarah Jenkins",
    specialty: "Physical Therapist",
    rating: 4.9,
    distance: "2.5 km",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&q=80",
    available: true,
  },
  {
    id: "2",
    name: "Dr. Michael Chen",
    specialty: "Sports Medicine",
    rating: 4.8,
    distance: "4.1 km",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&q=80",
    available: true,
  },
  {
    id: "3",
    name: "Dr. Emily Rodriguez",
    specialty: "Orthopedic",
    rating: 4.7,
    distance: "6.8 km",
    image: "https://images.unsplash.com/photo-1594824436998-da40d27ec09c?w=150&q=80",
    available: false,
  },
];

export function DoctorSearchPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDoctors = DOCTORS.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    doc.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Find a Specialist" />
      
      <div className="p-4 sm:p-6 space-y-6">
        <Input 
          placeholder="Search doctors or specialties..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />

        <div className="space-y-4">
          {filteredDoctors.map((doctor) => (
            <Card key={doctor.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex p-4">
                  <div 
                    className="h-20 w-20 rounded-lg bg-cover bg-center flex-shrink-0"
                    style={{ backgroundImage: `url(${doctor.image})` }}
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-base">{doctor.name}</h3>
                        <p className="text-sm text-primary">{doctor.specialty}</p>
                      </div>
                      {doctor.available ? (
                        <Badge variant="success" className="text-[10px]">Available</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Busy</Badge>
                      )}
                    </div>
                    
                    <div className="mt-2 flex items-center text-xs text-muted-foreground gap-3">
                      <span className="flex items-center"><Star className="h-3 w-3 text-amber-400 mr-1 fill-amber-400" /> {doctor.rating}</span>
                      <span className="flex items-center"><MapPin className="h-3 w-3 mr-1" /> {doctor.distance}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-px bg-border/50 border-t">
                  <Button variant="ghost" className="rounded-none h-10 text-muted-foreground hover:text-primary">
                    <Phone className="h-4 w-4 mr-2" /> Call
                  </Button>
                  <Button variant="ghost" className="rounded-none h-10 text-muted-foreground hover:text-primary">
                    <Video className="h-4 w-4 mr-2" /> Consult
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredDoctors.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No specialists found.
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
