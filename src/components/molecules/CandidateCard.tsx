import { cn } from '@/lib/utils';
import { Card, Avatar, AvatarImage, AvatarFallback, Badge } from '@/components/atoms';
import { getInitials } from '@/lib/utils';
import { Check } from 'lucide-react';

interface CandidateCardProps {
  name: string;
  position: string;
  photoUrl?: string;
  bio?: string;
  manifesto?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
  disabled?: boolean;
}

export function CandidateCard({
  name,
  position,
  photoUrl,
  bio,
  manifesto,
  isSelected = false,
  onSelect,
  className,
  disabled = false,
}: CandidateCardProps) {
  const isSelectable = !!onSelect && !disabled;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        isSelectable && 'cursor-pointer hover:border-primary/50',
        isSelected && 'border-primary ring-2 ring-primary/20',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={isSelectable ? onSelect : undefined}
      role={isSelectable ? 'button' : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onKeyDown={
        isSelectable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Header with photo and name */}
        <div className="flex items-start gap-3 min-w-0">
          <Avatar className="h-14 w-14 shrink-0">
            {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
            <AvatarFallback className="text-lg">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            <Badge variant="secondary" className="mt-1 w-fit">
              {position}
            </Badge>
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <p className="text-sm text-muted-foreground line-clamp-2 break-words">{bio}</p>
        )}

        {/* Manifesto preview */}
        {manifesto && (
          <div className="pt-3 border-t border-border space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Manifesto
            </p>
            <p className="text-sm text-muted-foreground line-clamp-3 break-words">
              {manifesto}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
