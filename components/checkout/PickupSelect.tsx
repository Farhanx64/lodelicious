"use client";

import { formatSlot, type Slot } from "@/src/lib/checkout/pickup";

import { useFormValues } from "./ActionForm";
import { field, label } from "./styles";

/**
 * Pickup times grouped by day; the server re-checks the choice on submit. After an error the
 * customer's choice stays selected (if that time is still offered), instead of snapping back to
 * the first slot.
 */
export function PickupSelect({ slots, id }: { slots: Slot[]; id: string }) {
  const values = useFormValues();
  const byDate = new Map<string, Slot[]>();
  for (const s of slots) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const chosen = values.pickup && slots.some((s) => `${s.date}|${s.start}` === values.pickup) ? values.pickup : undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className={label}>
        Pickup day and time
      </label>
      {slots.length === 0 ? (
        <p className="text-error">No pickup times are open right now. Please call us.</p>
      ) : (
        <select id={id} name="pickup" required defaultValue={chosen} className={field}>
          {[...byDate].map(([date, daySlots]) => (
            <optgroup key={date} label={formatSlot(daySlots[0]).split(",").slice(0, 2).join(",")}>
              {daySlots.map((s) => (
                <option key={s.start} value={`${s.date}|${s.start}`}>
                  {formatSlot(s)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}
