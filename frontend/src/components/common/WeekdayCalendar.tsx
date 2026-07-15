interface WeekdayCalendarProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  daysCount?: number;
}

export function WeekdayCalendar({ selectedDate, onChange, daysCount = 14 }: WeekdayCalendarProps) {
  const today = new Date();

  // Generate date array natively
  const dateList = Array.from({ length: daysCount }).map((_, index) => {
    const d = new Date();
    d.setDate(today.getDate() + index);
    return d;
  });

  const getDayName = (date: Date) => {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getDayNumber = (date: Date) => {
    return date.getDate();
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.toDateString() === d2.toDateString();
  };

  return (
    <div className="w-full">
      <p className="text-sm font-semibold mb-3 text-foreground/80">Select Date</p>
      <div className="flex gap-2 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory">
        {dateList.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          const isTodayDate = isSameDay(date, today);
          const isSunday = date.getDay() === 0;

          return (
            <button
              key={date.toString()}
              disabled={isSunday}
              type="button"
              onClick={() => onChange(date)}
              className={`flex-shrink-0 w-14 h-20 rounded-xl flex flex-col justify-center items-center border transition-all duration-200 snap-start select-none ${
                isSunday
                  ? "opacity-40 cursor-not-allowed border-border"
                  : isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-button scale-102 font-medium"
                  : "bg-card border-border hover:border-primary/50 text-foreground"
              }`}
            >
              <span className={`text-[10px] uppercase font-semibold ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {getDayName(date)}
              </span>
              <span className="text-lg font-bold mt-1">
                {getDayNumber(date)}
              </span>
              {isTodayDate && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
              )}
              {isSunday && (
                <span className="text-[8px] text-destructive/80 font-medium leading-none mt-1">Closed</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
