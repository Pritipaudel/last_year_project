import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter,Star,ChevronRight } from "lucide-react";
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
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const muscleGroups =  ["All", "Chest", "Back", "Legs", "Core", "Arms"];

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
          {muscleGroups.map((group)=>{
            const isSelected = selectedGroup === group;
            return(
              <Badge 
              key={group} 
              variant={isSelected ? "default" : "outline"}
              onClick={()=> setSelectedGroup(group)}
              className="cursor-pointer whitespace-nowrap px-4 py-2 text-sm"
            >
              {group}
            </Badge>
            )
          })}
        </div>

        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredExercises.map((exercise) => (
              <Card key={exercise.id} variant="interactive" onClick={() => navigate(`/exercises/${exercise.id}`)} className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm bg-white cursor-pointer">
                <div className="relative w-full h-52">
                  <img src={exercise.imageUrl} 
                  alt={exercise.name} className="w-full h-full object-cover"/>
                  <span className="absolute top-3 right-3 text-xs font-semibold px-3 py-1.5 rounded-full bg-teal-50 text-teal-700">{exercise.difficulty || "Beginner"}</span>
            </div>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                  {exercise.name}
                </h3>
                <Star className="w-5 h-5 text-slate-400 hover:text-yellow-400 transition-colors" />
              </div>
              <div className="flex justify-between items-center text-sm font-medium">
                <div className="flex items-center space-x-3 text-slate-500">
                  <span className="text-sm text-[var(--text-muted)]">
                    {exercise.muscleGroup || "Arms"}
                  </span>
              </div>
              <button className="flex items-center space-x-1 bg-teal-50 text-teal-700 px-4 py-2 rounded-full font-semibold hover:bg-teal-100 transition-colors">
                <span>Start</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
  </CardContent>
</Card>
            ))}
            
            {filteredExercises.length === 0 && (
              <div className="col-span-full py-12 text-center text-[var(--text-muted)]">
                No exercises found matching your search.
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
