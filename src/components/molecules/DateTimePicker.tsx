/**
 * DateTimePicker — Calendar + time picker built on shadcn Calendar + Radix Popover.
 *
 * Props:
 *   value        — ISO datetime string (or empty string)
 *   onChange     — called with new ISO string on any change
 *   label        — field label shown above the trigger
 *   placeholder  — text shown when nothing is selected
 *   minDate      — earliest selectable date/time (optional)
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
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const pad = (n: number) => String(n).padStart(2, '0');

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
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
    selectedDate ? pad(selectedDate.getHours()) : '09'
  );
  const [minute, setMinute] = React.useState(() =>
    selectedDate ? pad(selectedDate.getMinutes()) : '00'
  );

  // Sync hour/minute when value changes externally
  React.useEffect(() => {
    if (selectedDate) {
      setHour(pad(selectedDate.getHours()));
      setMinute(pad(selectedDate.getMinutes()));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Emit a local-time ISO string, clamping to minDate + 1 min if needed */
  const emitChange = (date: Date | undefined, h: string, m: string) => {
    if (!date) return;
    const d = new Date(date);
    d.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);

    // Enforce minimum datetime — snap forward 1 minute past minDate
    if (minDate && d <= minDate) {
      const snapped = new Date(minDate.getTime() + 60 * 1000);
      d.setTime(snapped.getTime());
      setHour(pad(snapped.getHours()));
      setMinute(pad(snapped.getMinutes()));
    }

    onChange(toLocalISO(d));
  };

  /** Returns now + 5 minutes as { h, m } strings */
  const nowPlus5 = () => {
    const t = new Date(Date.now() + 5 * 60 * 1000);
    return { h: pad(t.getHours()), m: pad(t.getMinutes()) };
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    let h = hour;
    let m = minute;

    const now = new Date();
    if (isSameCalendarDay(day, now)) {
      // Today — snap to now + 5 min
      const plus5 = nowPlus5();
      h = plus5.h;
      m = plus5.m;
      setHour(h);
      setMinute(m);
    } else if (minDate && isSameCalendarDay(day, minDate)) {
      // Same day as minDate — snap to minDate + 1 min
      const snapped = new Date(minDate.getTime() + 60 * 1000);
      h = pad(snapped.getHours());
      m = pad(snapped.getMinutes());
      setHour(h);
      setMinute(m);
    }

    emitChange(day, h, m);
  };

  // Allow intermediate typing (e.g. "1" before typing "2" → "12")
  // Only clamp + emit when 2 digits are entered; normalize on blur
  const handleHour = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHour(raw);
    if (raw.length === 2) {
      const clamped = pad(Math.min(23, parseInt(raw, 10)));
      setHour(clamped);
      emitChange(selectedDate, clamped, minute);
    }
  };

  const handleHourBlur = () => {
    const clamped = pad(Math.min(23, parseInt(hour || '0', 10)));
    setHour(clamped);
    emitChange(selectedDate, clamped, minute);
  };

  const handleMinute = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinute(raw);
    if (raw.length === 2) {
      const clamped = pad(Math.min(59, parseInt(raw, 10)));
      setMinute(clamped);
      emitChange(selectedDate, hour, clamped);
    }
  };

  const handleMinuteBlur = () => {
    const clamped = pad(Math.min(59, parseInt(minute || '0', 10)));
    setMinute(clamped);
    emitChange(selectedDate, hour, clamped);
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
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Time</span>
              <span className="text-xs text-muted-foreground/60">24-hour format</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="text"
                inputMode="numeric"
                value={hour}
                onChange={handleHour}
                onBlur={handleHourBlur}
                onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 0); }}
                maxLength={2}
                placeholder="HH"
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
                onBlur={handleMinuteBlur}
                onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 0); }}
                maxLength={2}
                placeholder="MM"
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
