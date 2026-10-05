import { field, label } from "./styles";

export function ContactFields({ prefix }: { prefix: string }) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-3 font-display text-xl text-gold-text">Your details</legend>
      <div className="mb-3">
        <label htmlFor={`${prefix}-name`} className={label}>
          Name
        </label>
        <input id={`${prefix}-name`} name="name" autoComplete="name" required maxLength={100} className={field} />
      </div>
      <div className="mb-3">
        <label htmlFor={`${prefix}-email`} className={label}>
          Email
        </label>
        <input id={`${prefix}-email`} name="email" type="email" autoComplete="email" required maxLength={200} className={field} />
      </div>
      <div>
        <label htmlFor={`${prefix}-phone`} className={label}>
          Phone
        </label>
        <input id={`${prefix}-phone`} name="phone" type="tel" autoComplete="tel" required maxLength={30} className={field} />
      </div>
    </fieldset>
  );
}
