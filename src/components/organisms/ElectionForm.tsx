import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/atoms';
import { FormField, AlertMessage } from '@/components/molecules';
import { Loader2, Plus, X } from 'lucide-react';

interface ElectionFormData {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  resultAnnouncementTime: string;
  positions: string[];
}

interface ElectionFormProps {
  initialData?: Partial<ElectionFormData>;
  onSubmit: (data: ElectionFormData) => void;
  isLoading?: boolean;
  error?: string;
  mode?: 'create' | 'edit';
  className?: string;
}

export function ElectionForm({
  initialData,
  onSubmit,
  isLoading = false,
  error,
  mode = 'create',
  className,
}: ElectionFormProps) {
  const [formData, setFormData] = React.useState<ElectionFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    startTime: initialData?.startTime || '',
    endTime: initialData?.endTime || '',
    resultAnnouncementTime: initialData?.resultAnnouncementTime || '',
    positions: initialData?.positions || [],
  });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [newPosition, setNewPosition] = React.useState('');

  const handleChange = (field: keyof ElectionFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleAddPosition = () => {
    const trimmed = newPosition.trim();
    if (trimmed && !formData.positions.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        positions: [...prev.positions, trimmed],
      }));
      setNewPosition('');
      if (formErrors.positions) {
        setFormErrors((prev) => {
          const { positions: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  const handleRemovePosition = (position: string) => {
    setFormData((prev) => ({
      ...prev,
      positions: prev.positions.filter((p) => p !== position),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPosition();
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Election name is required';
    }

    if (!formData.startTime) {
      errors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      errors.endTime = 'End time is required';
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime);
      const end = new Date(formData.endTime);
      if (end <= start) {
        errors.endTime = 'End time must be after start time';
      }
    }

    if (formData.resultAnnouncementTime && formData.endTime) {
      const end = new Date(formData.endTime);
      const results = new Date(formData.resultAnnouncementTime);
      if (results < end) {
        errors.resultAnnouncementTime = 'Results cannot be announced before election ends';
      }
    }

    if (formData.positions.length === 0) {
      errors.positions = 'At least one position is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Create Election' : 'Edit Election'}
        </CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'Set up a new election with positions and timing'
            : 'Update election details'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <AlertMessage variant="error">{error}</AlertMessage>}

          {/* Basic Info */}
          <div className="space-y-4">
            <FormField
              label="Election Name"
              type="text"
              placeholder="e.g., 2026 Board Elections"
              value={formData.name}
              onChange={handleChange('name')}
              error={formErrors.name}
              disabled={isLoading}
              required
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                placeholder="Describe the election purpose and details..."
                value={formData.description}
                onChange={handleChange('description')}
                disabled={isLoading}
                className={cn(
                  'flex min-h-25 w-full rounded-md border border-input bg-background px-3 py-2',
                  'text-sm ring-offset-background placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              />
            </div>
          </div>

          {/* Timing */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Election Schedule</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Start Date & Time"
                type="datetime-local"
                value={formData.startTime}
                onChange={handleChange('startTime')}
                error={formErrors.startTime}
                disabled={isLoading}
                required
              />
              <FormField
                label="End Date & Time"
                type="datetime-local"
                value={formData.endTime}
                onChange={handleChange('endTime')}
                error={formErrors.endTime}
                disabled={isLoading}
                required
              />
            </div>
            <FormField
              label="Result Announcement Time (Optional)"
              type="datetime-local"
              value={formData.resultAnnouncementTime}
              onChange={handleChange('resultAnnouncementTime')}
              error={formErrors.resultAnnouncementTime}
              disabled={isLoading}
            />
          </div>

          {/* Positions */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Positions</h4>

            <div className="flex gap-2">
              <div className="flex-1">
                <FormField
                  label=""
                  type="text"
                  placeholder="e.g., President, Vice President, Secretary"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddPosition}
                disabled={isLoading || !newPosition.trim()}
                className="mt-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {formErrors.positions && (
              <p className="text-sm text-destructive">{formErrors.positions}</p>
            )}

            {formData.positions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.positions.map((position) => (
                  <Badge
                    key={position}
                    variant="secondary"
                    className="flex items-center gap-1 pl-3 pr-1 py-1"
                  >
                    {position}
                    <button
                      type="button"
                      onClick={() => handleRemovePosition(position)}
                      disabled={isLoading}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Election' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
