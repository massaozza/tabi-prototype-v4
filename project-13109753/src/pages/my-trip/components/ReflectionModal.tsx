import { useState, type FormEvent } from 'react';
import type { Trip } from '../types';

interface ReflectionModalProps {
  trip: Trip;
  onClose: () => void;
  onSaved: (updatedTrip: Trip) => void;
}

const inputClass =
  'w-full bg-background-50 border border-background-200 rounded-md px-3.5 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all';

export default function ReflectionModal({ trip, onClose, onSaved }: ReflectionModalProps) {
  const [actualTotalCost, setActualTotalCost] = useState(
    trip.actualTotalCost !== undefined ? String(trip.actualTotalCost) : ''
  );
  const [reflectionWhatWorked, setReflectionWhatWorked] = useState(
    trip.reflectionWhatWorked || ''
  );
  const [reflectionWhatToChange, setReflectionWhatToChange] = useState(
    trip.reflectionWhatToChange || ''
  );
  const [nationality, setNationality] = useState(trip.nationality || '');
  const [travelStyle, setTravelStyle] = useState(trip.travelStyle || '');
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | undefined>(trip.isFirstVisit);
  const [budgetLevel, setBudgetLevel] = useState(trip.budgetLevel || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = reflectionWhatWorked.trim() !== '' && !submitting;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(trip.id)}&action=reflect`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          actualTotalCost: actualTotalCost ? Number(actualTotalCost) : undefined,
          reflectionWhatWorked: reflectionWhatWorked.trim(),
          reflectionWhatToChange: reflectionWhatToChange.trim(),
          nationality: nationality.trim(),
          travelStyle: travelStyle.trim(),
          isFirstVisit,
          budgetLevel: budgetLevel.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save');
      }
      onSaved(data.trip);
    } catch {
      setError('Could not save your reflection. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-lg text-foreground-900">
            How did your trip go?
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-foreground-700 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <p className="text-foreground-500 text-sm mb-6">
          Adding your real experience helps other travelers — and lets you publish this
          Trip so others can save or copy it.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground-700 mb-1.5">
              What worked well? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reflectionWhatWorked}
              onChange={(e) => setReflectionWhatWorked(e.target.value)}
              rows={3}
              placeholder="What made this trip great?"
              required
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground-700 mb-1.5">
              What would you change next time?
            </label>
            <textarea
              value={reflectionWhatToChange}
              onChange={(e) => setReflectionWhatToChange(e.target.value)}
              rows={2}
              placeholder="Anything you'd do differently?"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground-700 mb-1.5">
              Actual total cost (optional)
            </label>
            <input
              type="number"
              min="0"
              value={actualTotalCost}
              onChange={(e) => setActualTotalCost(e.target.value)}
              placeholder="e.g. 250000"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground-700 mb-1.5">
                Nationality
              </label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="e.g. Australia"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground-700 mb-1.5">
                Travel style
              </label>
              <input
                type="text"
                value={travelStyle}
                onChange={(e) => setTravelStyle(e.target.value)}
                placeholder="e.g. Solo, Couple, Family"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground-700 mb-1.5">
                Budget level
              </label>
              <input
                type="text"
                value={budgetLevel}
                onChange={(e) => setBudgetLevel(e.target.value)}
                placeholder="e.g. Mid-range"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground-700 mb-1.5">
                First visit to Japan?
              </label>
              <select
                value={isFirstVisit === undefined ? '' : isFirstVisit ? 'yes' : 'no'}
                onChange={(e) =>
                  setIsFirstVisit(
                    e.target.value === '' ? undefined : e.target.value === 'yes'
                  )
                }
                className={inputClass}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No, been before</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {submitting ? 'Saving...' : 'Save Reflection'}
          </button>
        </form>
      </div>
    </div>
  );
}
