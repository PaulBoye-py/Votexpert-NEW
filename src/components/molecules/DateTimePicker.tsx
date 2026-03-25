/**
 * DateTimePicker — Calendar + time picker built on shadcn Calendar + Radix Popover.
 *
 * Props:
 *   value        — ISO datetime string (or empty string)
 *   onChange     — called with new ISO string on any change
 *   label        — field label shown above the trigger
 *   placeholder  — text shown when nothing is selected
 *   minDate      — earliest selectable date (optional)
 *   error        — validation error message (optional)
 *   disabled     — disables the picker (optional)
 */
import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateTimePickerProps {
  value: string;
  onChange: (iso: string) => void;
  label: string;
  placeholder?: string;
  minDate?: Date;
  error?: string;
  disabled?: boolean;
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function DateTimePicker({
  value,
  onChange,
  label,
  placeholder = 'Pick a date and time',
  minDate,
  error,
  disabled = false,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse current value into date + time parts
  const parsed = value ? new Date(value) : null;
  const selectedDate: Date | undefined = parsed && !isNaN(parsed.getTime()) ? parsed : undefined;
  const [hour, setHour] = React.useState(() =>
    selectedDate ? String(selectedDate.getHours()).padStart(2, '0') : '09'
  );
  const [minute, setMinute] = React.useState(() =>
    selectedDate ? String(selectedDate.getMinutes()).padStart(2, '0') : '00'
  );

  // Sync hour/minute when value changes externally
  React.useEffect(() => {
    if (selectedDate) {
      setHour(String(selectedDate.getHours()).padStart(2, '0'));
      setMinute(String(selectedDate.getMinutes()).padStart(2, '0'));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const emitChange = (date: Date | undefined, h: string, m: string) => {
    if (!date) return;
    const d = new Date(date);
    d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    onChange(d.toISOString().slice(0, 16)); // "YYYY-MM-DDTHH:mm"
  };

  /** Returns now + 5 minutes as { h, m } strings */
  const nowPlus5 = () => {
    const t = new Date(Date.now() + 5 * 60 * 1000);
    return {
      h: String(t.getHours()).padStart(2, '0'),
      m: String(t.getMinutes()).padStart(2, '0'),
    };
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    let h = hour;
    let m = minute;
    // When picking today, snap time to now + 5 min so it's always valid
    if (isToday(day)) {
      const plus5 = nowPlus5();
      h = plus5.h;
      m = plus5.m;
      setHour(h);
      setMinute(m);
    }
    emitChange(day, h, m);
  };

  const handleHour = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    const clamped = Math.min(23, parseInt(v || '0', 10));
    const formatted = String(clamped).padStart(2, '0');
    setHour(formatted);
    emitChange(selectedDate, formatted, minute);
  };

  const handleMinute = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    const clamped = Math.min(59, parseInt(v || '0', 10));
    const formatted = String(clamped).padStart(2, '0');
    setMinute(formatted);
    emitChange(selectedDate, hour, formatted);
  };

  const display = formatDisplay(value);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium leading-none text-foreground">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors text-left',
              'bg-background ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
              error
                ? 'border-destructive'
                : open
                  ? 'border-green-500 ring-2 ring-green-500/20'
                  : 'border-input hover:border-green-500/60',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <CalendarIcon className={cn('h-4 w-4 shrink-0', display ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
            <span className={cn('flex-1 truncate', display ? 'text-foreground' : 'text-muted-foreground')}>
              {display || placeholder}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto p-0 shadow-lg border-border"
          align="start"
          sideOffset={6}
        >
          {/* Calendar */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            disabled={minDate ? (date) => {
                const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
                return d < min;
              } : undefined}
            initialFocus
            classNames={{
              day: cn(
                'group/day relative aspect-square h-full w-full p-0 text-center select-none',
                '[&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md'
              ),
            }}
            modifiersClassNames={{
              selected: '[&_button]:!bg-green-600 [&_button]:!text-white [&_button]:hover:!bg-green-700',
              today: '[&_button]:border [&_button]:border-green-500/50 [&_button]:text-green-700 dark:[&_button]:text-green-400',
            }}
          />

          {/* Divider */}
          <div className="border-t border-border mx-3" />

          {/* Time picker */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Clock className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-sm text-muted-foreground">Time</span>
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="text"
                inputMode="numeric"
                value={hour}
                onChange={handleHour}
                onFocus={(e) => e.target.select()}
                maxLength={2}
                aria-label="Hour"
                className={cn(
                  'w-10 rounded-md border border-input bg-background px-2 py-1 text-center text-sm font-mono tabular-nums',
                  'focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20',
                  !selectedDate && 'opacity-40'
                )}
                disabled={!selectedDate}
              />
              <span className="text-muted-foreground font-bold text-base leading-none">:</span>
              <input
                type="text"
                inputMode="numeric"
                value={minute}
                onChange={handleMinute}
                onFocus={(e) => e.target.select()}
                maxLength={2}
                aria-label="Minute"
                className={cn(
                  'w-10 rounded-md border border-input bg-background px-2 py-1 text-center text-sm font-mono tabular-nums',
                  'focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20',
                  !selectedDate && 'opacity-40'
                )}
                disabled={!selectedDate}
              />
            </div>
          </div>

          {/* Done button */}
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={!selectedDate}
              className={cn(
                'w-full rounded-md py-1.5 text-sm font-medium transition-colors',
                selectedDate
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {selectedDate ? 'Done' : 'Select a date first'}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
