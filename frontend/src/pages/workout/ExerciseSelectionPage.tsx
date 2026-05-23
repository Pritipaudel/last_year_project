import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { exerciseService, Exercise } from "@/services/exerciseService";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export function ExerciseSelectionPage() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const data = await exerciseService.getExercises();
        setExercises(data);
      } catch (error) {
        console.error("Failed to load exercises", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExercises();
  }, []);

  const filteredExercises = exercises.filter(
    (ex) => ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Exercises" />
      
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex space-x-2">
          <Input 
            placeholder="Search exercises..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="flex-1"
          />
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
          {["All", "Chest", "Back", "Legs", "Core", "Arms"].map((group) => (
            <Badge 
              key={group} 
              variant={group === "All" ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap px-4 py-1.5"
            >
              {group}
            </Badge>
          ))}
        </div>

        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredExercises.map((exercise) => (
              <Card 
                key={exercise.id} 
                variant="interactive"
                onClick={() => navigate(`/exercises/${exercise.id}`)}
                className="overflow-hidden"
              >
                <div 
                  className="h-32 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${exercise.imageUrl})` }}
                />
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{exercise.name}</h3>
                    <Badge variant="secondary" className="text-[10px]">{exercise.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                </CardContent>
              </Card>
            ))}
            
            {filteredExercises.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                No exercises found matching your search.
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
