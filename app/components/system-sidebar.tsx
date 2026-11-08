"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function initials(value: string) {
  return value
    .split(/[@.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

type NavKey = "inicio" | "oportunidades" | "orcamentos" | "automacoes";

const navItems: { key: NavKey; href: string; icon: string; label: string }[] = [
  { key: "inicio", href: "/sistema", icon: "▦", label: "Visão geral" },
  {
    key: "oportunidades",
    href: "/sistema#oportunidades",
    icon: "◎",
    label: "Solicitações",
  },
  {
    key: "orcamentos",
    href: "/sistema#orcamentos",
    icon: "▤",
    label: "Orçamentos",
  },
  {
    key: "automacoes",
    href: "/sistema#automacoes",
    icon: "⌁",
    label: "Automações",
  },
];

function keyFromHash(hash: string): NavKey {
  const name = hash.replace("#", "");
  return name === "oportunidades" ||
    name === "orcamentos" ||
    name === "automacoes"
    ? name
    : "inicio";
}

export function SystemSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const [hashKey, setHashKey] = useState<NavKey>("inicio");

  // Lê o hash atual (ex.: /sistema#orcamentos) e acompanha mudanças feitas
  // pelo navegador (voltar/avançar ou edição manual da URL).
  useEffect(() => {
    const sync = () => setHashKey(keyFromHash(window.location.hash));
    const frame = requestAnimationFrame(sync);
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [pathname]);

  // Na tela de detalhe de uma solicitação, o item "Solicitações" fica selecionado.
  const activeKey: NavKey = pathname.startsWith("/sistema/solicitacoes")
    ? "oportunidades"
    : hashKey;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Image src="/logo-wg-mark.png" alt="" width={400} height={125} />
        </span>
        <span>
          WG Hidráulica<small>Central comercial</small>
        </span>
      </div>
      <nav aria-label="Navegação principal">
        {navItems.map((item) => (
          <Link
            key={item.key}
            className={`nav-item${activeKey === item.key ? " active" : ""}`}
            href={item.href}
            aria-current={activeKey === item.key ? "page" : undefined}
            onClick={() => setHashKey(item.key)}
          >
            {item.icon} <span>{item.label}</span>
          </Link>
        ))}
        <Link className="nav-item" href="/">
          ↗ <span>Ver site</span>
        </Link>
      </nav>
      <div className="profile">
        <span className="avatar">{initials(adminEmail)}</span>
        <span className="profile-details">
          {adminEmail}
          <small>Administrador</small>
        </span>
        <form action="/api/auth/logout" method="post">
          <button type="submit">Sair</button>
        </form>
      </div>
    </aside>
  );
}
