"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";

const ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/companies", label: "Empresas" },
  { href: "/pipeline", label: "CRM" },
  { href: "/searches", label: "Búsquedas" },
  { href: "/settings", label: "Configuración" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="side" aria-label="Principal">
      <div className="brand">Prospect Intelligence</div>
      {ITEMS.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return <Link key={i.href} href={i.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>{i.label}</Link>;
      })}
      <div className="spacer" />
      <form action={logout}><button className="link" type="submit">Salir</button></form>
    </nav>
  );
}
