import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  className?: string;
}

export function StarRating({ rating, maxStars = 5, size = 16, className = "" }: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.25 && rating % 1 < 0.75;
  const hasThreeQuarterStar = rating % 1 >= 0.75;
  const countFullStars = fullStars + (hasThreeQuarterStar ? 1 : 0);

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: maxStars }).map((_, index) => {
        const starIndex = index + 1;
        let isFilled = starIndex <= countFullStars;
        let isHalf = !isFilled && starIndex === countFullStars + 1 && hasHalfStar;

        return (
          <div key={index} className="relative" style={{ width: size, height: size }}>
            <Star
              size={size}
              className={`absolute top-0 left-0 transition-colors duration-150 ${
                isFilled
                  ? "text-amber-400 fill-amber-400"
                  : "text-muted-foreground/30 fill-none"
              }`}
            />
            {isHalf && (
              <div className="absolute top-0 left-0 overflow-hidden" style={{ width: "50%" }}>
                <Star
                  size={size}
                  className="text-amber-400 fill-amber-400"
                />
              </div>
            )}
          </div>
        );
      })}
      <span className="ml-1 text-xs font-semibold text-foreground/80">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}
