import { formatSlot, type Slot } from "@/src/lib/checkout/pickup";

import { field, label } from "./styles";

/** Pickup times grouped by day; the server re-checks the choice on submit. */
export function PickupSelect({ slots, id }: { slots: Slot[]; id: string }) {
  const byDate = new Map<string, Slot[]>();
  for (const s of slots) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  return (
    <div className="mb-4">
      <label htmlFor={id} className={label}>
        Pickup day and time
      </label>
      {slots.length === 0 ? (
        <p className="text-error">No pickup times are open right now. Please call us.</p>
      ) : (
        <select id={id} name="pickup" required className={field}>
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
