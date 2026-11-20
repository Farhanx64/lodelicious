import { redirect } from "next/navigation";

/** Login and header logo in the admin. */
export function BrandLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static brand asset
    <img src="/brand/logo-512.png" alt="Lodelicious" width={220} height={220} style={{ maxWidth: 220, height: "auto" }} />
  );
}

/** The small square mark in the admin nav. */
export function BrandIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static brand asset
    <img src="/brand/logo-512.png" alt="Lodelicious" width={32} height={32} style={{ borderRadius: 6 }} />
  );
}

/** Sidebar link back to the 3D dashboard. */
export function DashboardNavLink() {
  return (
    <a href="/dashboard" className="nav__link" style={{ display: "block", padding: "0.5rem 0", fontWeight: 600, color: "#9c4459" }}>
      ✦ Shop dashboard
    </a>
  );
}

/** The admin home is the 3D dashboard; the collection list stays one click away in the sidebar. */
export function DashboardRedirect(): never {
  redirect("/dashboard");
}
