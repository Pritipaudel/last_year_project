import { AvailabilitySlot } from "@/services/doctorService";
import { Button } from "@/components/ui/Button";

interface TimeSlotPickerProps {
  slots: AvailabilitySlot[];
  selectedSlotId: number | null;
  onChange: (slot: AvailabilitySlot) => void;
  isLoading?: boolean;
}

export function TimeSlotPicker({
  slots,
  selectedSlotId,
  onChange,
  isLoading = false,
}: TimeSlotPickerProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground/80">Available Slots</p>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-lg bg-muted animate-pulse border border-transparent"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground/80">
        Available Slots
      </p>

      {slots.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-xl bg-card">
          <p className="text-sm text-muted-foreground">No available slots for this day.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const isSelected = selectedSlotId === slot.id;

            return (
              <Button
                key={slot.id}
                type="button"
                variant={isSelected ? "default" : "outline"}
                className={`h-10 text-xs font-semibold rounded-lg truncate transition-all duration-150 ${
                  isSelected ? "shadow-button" : "bg-card hover:border-primary/50"
                }`}
                onClick={() => onChange(slot)}
              >
                {slot.formattedTime}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
