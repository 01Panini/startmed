import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FormEvent, ReactElement } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BarChart3,
  CalendarDays,
  Download,
  Gauge,
  KanbanSquare,
  LogOut,
  Mail,
  Phone,
  Search,
  Settings,
  Table2,
  UserRound,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import "./admin.css";

type View = "dashboard" | "leads" | "funil" | "agenda" | "configuracoes";

type Status =
  | "Novo Lead"
  | "Quiz Concluído"
  | "Interessado"
  | "Contato Realizado"
  | "Convertido"
  | "Não Interessado";

type FunnelEvent = {
  id: number;
  lead_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  profile: string;
  objective: string;
  source: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  events: FunnelEvent[];
};

const storageKey = "startmed_funnel_events";

const nav: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "leads", label: "Leads", icon: Table2 },
  { id: "funil", label: "Funil", icon: KanbanSquare },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

const stages: Status[] = [
  "Novo Lead",
  "Quiz Concluído",
  "Interessado",
  "Contato Realizado",
  "Convertido",
  "Não Interessado",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function localStatusKey(id: string): string {
  return `startmed_status_${id}`;
}

function eventStatus(events: FunnelEvent[], override?: Status): Status {
  if (override) return override;
  const types = new Set(events.map((event) => event.event_type));

  if (types.has("lead_not_interested")) return "Não Interessado";
  if (types.has("meeting_requested")) return "Contato Realizado";
  if (types.has("presentation_requested")) return "Interessado";
  if (types.has("quiz_completed")) return "Quiz Concluído";

  return "Novo Lead";
}

function readStatusOverride(id: string): Status | undefined {
  const status = window.localStorage.getItem(localStatusKey(id));
  return stages.includes(status as Status) ? (status as Status) : undefined;
}

function groupEvents(events: FunnelEvent[]): Lead[] {
  const grouped = new Map<string, FunnelEvent[]>();

  for (const event of events) {
    if (!event.lead_id) continue;
    grouped.set(event.lead_id, [...(grouped.get(event.lead_id) ?? []), event]);
  }

  return Array.from(grouped.entries())
    .map(([id, leadEvents]) => {
      const ordered = [...leadEvents].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const created = ordered[0];
      const latest = ordered.at(-1) ?? created;
      const latestPayload = latest?.payload ?? {};
      const createdPayload = created?.payload ?? {};

      return {
        id,
        name: asString(createdPayload.name) || asString(latestPayload.name) || "Lead sem nome",
        phone: asString(createdPayload.phone) || asString(latestPayload.phone),
        email: asString(createdPayload.email) || asString(latestPayload.email),
        city: asString(createdPayload.city) || asString(latestPayload.city),
        profile: asString(latestPayload.profile) || asString(latestPayload.moment) || "Não informado",
        objective: asString(latestPayload.objective) || "Não informado",
        source: asString(createdPayload.source) || "Landing StartMed",
        status: eventStatus(ordered, readStatusOverride(id)),
        createdAt: created.created_at,
        updatedAt: latest.created_at,
        events: ordered,
      } satisfies Lead;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function readLocalEvents(): FunnelEvent[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FunnelEvent[]) : [];
  } catch {
    return [];
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function exportCsv(leads: Lead[]): void {
  const rows = [
    ["nome", "telefone", "email", "cidade", "perfil", "objetivo", "status", "criado_em"],
    ...leads.map((lead) => [
      lead.name,
      lead.phone,
      lead.email,
      lead.city,
      lead.profile,
      lead.objective,
      lead.status,
      lead.createdAt,
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "startmed-leads.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function AuthScreen(): ReactElement {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) setMessage(error.message);
  }

  return (
    <main className="admin-login">
      <section className="login-card">
        <img src="/startmed-logo.svg" alt="StartMed" className="login-logo" />
        <p className="eyebrow">Acesso protegido</p>
        <h1>CRM StartMed</h1>
        <p>Entre com uma conta criada no Supabase Auth para visualizar leads reais.</p>

        <form onSubmit={handleLogin} className="login-form">
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {message && <p className="form-error">{message}</p>}
      </section>
    </main>
  );
}

function App(): ReactElement {
  const [view, setView] = useState<View>("dashboard");
  const [events, setEvents] = useState<FunnelEvent[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setEvents(readLocalEvents());
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;

    async function loadEvents() {
      setLoading(true);
      const { data, error } = await supabase!
        .from("startmed_funnel_events")
        .select("id, lead_id, event_type, payload, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) setEvents(data as FunnelEvent[]);
      setLoading(false);
    }

    loadEvents();
  }, [session]);

  useEffect(() => {
    function syncLocalEvents() {
      if (!supabase) setEvents(readLocalEvents());
    }

    window.addEventListener("storage", syncLocalEvents);
    window.addEventListener("startmed:funnel-event", syncLocalEvents);
    return () => {
      window.removeEventListener("storage", syncLocalEvents);
      window.removeEventListener("startmed:funnel-event", syncLocalEvents);
    };
  }, []);

  const leads = useMemo(() => groupEvents(events), [events]);
  const filteredLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return leads;

    return leads.filter((lead) =>
      [lead.name, lead.phone, lead.email, lead.city, lead.profile, lead.objective, lead.status]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [leads, query]);

  const stats = useMemo(() => {
    const interested = leads.filter((lead) =>
      ["Interessado", "Contato Realizado", "Convertido"].includes(lead.status),
    ).length;
    const converted = leads.filter((lead) => lead.status === "Convertido").length;
    return {
      leads: leads.length,
      interested,
      converted,
      conversion: leads.length ? Math.round((converted / leads.length) * 100) : 0,
    };
  }, [leads]);

  if (isSupabaseConfigured && !session) return <AuthScreen />;

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  function updateLeadStatus(lead: Lead, status: Status) {
    window.localStorage.setItem(localStatusKey(lead.id), status);
    setEvents((current) => [...current]);
    setSelectedLead((current) => (current && current.id === lead.id ? { ...current, status } : current));
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <img src="/startmed-mark.svg" alt="" />
          <span>StartMed</span>
        </a>

        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={view === item.id ? "active" : ""}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <p>{isSupabaseConfigured ? "Supabase conectado" : "Modo demo local"}</p>
          <small>
            {isSupabaseConfigured
              ? "Lendo eventos da tabela startmed_funnel_events."
              : "Os leads aparecem a partir do localStorage deste navegador."}
          </small>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Painel comercial</p>
            <h1>CRM StartMed</h1>
          </div>

          <div className="topbar-actions">
            <label className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar lead, cidade, status..."
              />
            </label>
            <button type="button" className="ghost-button" onClick={() => exportCsv(filteredLeads)}>
              <Download size={17} />
              Exportar
            </button>
            {session && (
              <button type="button" className="ghost-button" onClick={signOut}>
                <LogOut size={17} />
                Sair
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <section className="empty-state">Carregando leads...</section>
        ) : (
          <>
            {view === "dashboard" && <Dashboard stats={stats} leads={filteredLeads} />}
            {view === "leads" && (
              <Leads
                leads={filteredLeads}
                onSelect={setSelectedLead}
                onChangeStatus={updateLeadStatus}
              />
            )}
            {view === "funil" && (
              <Pipeline
                leads={filteredLeads}
                onSelect={setSelectedLead}
                onChangeStatus={updateLeadStatus}
              />
            )}
            {view === "agenda" && <Agenda />}
            {view === "configuracoes" && <SettingsView />}
          </>
        )}
      </section>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onChangeStatus={updateLeadStatus}
        />
      )}
    </main>
  );
}

function Dashboard({
  stats,
  leads,
}: {
  stats: { leads: number; interested: number; converted: number; conversion: number };
  leads: Lead[];
}): ReactElement {
  return (
    <div className="view-stack">
      <section className="metrics-grid">
        <article className="metric-card">
          <UserRound />
          <span>Total de leads</span>
          <strong>{stats.leads}</strong>
        </article>
        <article className="metric-card">
          <Phone />
          <span>Leads interessados</span>
          <strong>{stats.interested}</strong>
        </article>
        <article className="metric-card">
          <BarChart3 />
          <span>Convertidos</span>
          <strong>{stats.converted}</strong>
        </article>
        <article className="metric-card">
          <Gauge />
          <span>Conversão</span>
          <strong>{stats.conversion}%</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Últimas entradas</p>
            <h2>Leads recentes</h2>
          </div>
        </div>
        <LeadTable leads={leads.slice(0, 6)} onSelect={() => undefined} onChangeStatus={() => undefined} compact />
      </section>
    </div>
  );
}

function Leads({
  leads,
  onSelect,
  onChangeStatus,
}: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onChangeStatus: (lead: Lead, status: Status) => void;
}): ReactElement {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Base comercial</p>
          <h2>Leads capturados</h2>
        </div>
        <span>{leads.length} registros</span>
      </div>
      <LeadTable leads={leads} onSelect={onSelect} onChangeStatus={onChangeStatus} />
    </section>
  );
}

function LeadTable({
  leads,
  onSelect,
  onChangeStatus,
  compact = false,
}: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onChangeStatus: (lead: Lead, status: Status) => void;
  compact?: boolean;
}): ReactElement {
  if (!leads.length) {
    return <div className="empty-state">Nenhum lead ainda. Preencha o formulário da landing para testar.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Contato</th>
            <th>Objetivo</th>
            <th>Status</th>
            <th>Entrada</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} onClick={() => onSelect(lead)}>
              <td>
                <strong>{lead.name}</strong>
                <span>{lead.city || "Cidade não informada"}</span>
              </td>
              <td>
                <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} onClick={(event) => event.stopPropagation()}>
                  {lead.phone || "Sem telefone"}
                </a>
                <span>{lead.email || "Sem e-mail"}</span>
              </td>
              <td>{lead.objective}</td>
              <td onClick={(event) => event.stopPropagation()}>
                {compact ? (
                  <StatusBadge status={lead.status} />
                ) : (
                  <select value={lead.status} onChange={(event) => onChangeStatus(lead, event.target.value as Status)}>
                    {stages.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                )}
              </td>
              <td>{formatDate(lead.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pipeline({
  leads,
  onSelect,
  onChangeStatus,
}: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onChangeStatus: (lead: Lead, status: Status) => void;
}): ReactElement {
  return (
    <section className="kanban">
      {stages.map((stage) => {
        const stageLeads = leads.filter((lead) => lead.status === stage);

        return (
          <article key={stage} className="kanban-column">
            <header>
              <h2>{stage}</h2>
              <span>{stageLeads.length}</span>
            </header>
            <div className="kanban-list">
              {stageLeads.map((lead) => (
                <button key={lead.id} type="button" className="lead-card" onClick={() => onSelect(lead)}>
                  <strong>{lead.name}</strong>
                  <span>{lead.objective}</span>
                  <small>{lead.phone}</small>
                </button>
              ))}
              {!stageLeads.length && <p className="muted">Sem leads neste estágio.</p>}
            </div>
          </article>
        );
      })}
      <div className="kanban-helper">
        <p>Para mudar um lead de etapa, abra a tabela ou os detalhes do lead.</p>
        <button
          type="button"
          onClick={() => {
            const firstLead = leads[0];
            if (firstLead) onChangeStatus(firstLead, "Contato Realizado");
          }}
        >
          Marcar primeiro como contatado
        </button>
      </div>
    </section>
  );
}

function Agenda(): ReactElement {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Próximo passo</p>
          <h2>Agenda de contato</h2>
        </div>
      </div>
      <div className="empty-state">
        Conecte Calendly, Google Calendar ou um webhook depois que a operação escolher o processo de atendimento.
      </div>
    </section>
  );
}

function SettingsView(): ReactElement {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Configuração</p>
          <h2>Integração e banco</h2>
        </div>
      </div>
      <div className="settings-grid">
        <article>
          <strong>Supabase</strong>
          <p>
            {isSupabaseConfigured
              ? "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY detectadas."
              : "Sem variáveis de ambiente. O projeto usa modo demo com localStorage."}
          </p>
        </article>
        <article>
          <strong>Tabela</strong>
          <p>Use o SQL em supabase/startmed_schema.sql para habilitar eventos reais com RLS.</p>
        </article>
        <article>
          <strong>Segurança</strong>
          <p>Nunca coloque service_role no frontend. Use apenas a chave publicável/anon.</p>
        </article>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: Status }): ReactElement {
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function LeadDrawer({
  lead,
  onClose,
  onChangeStatus,
}: {
  lead: Lead;
  onClose: () => void;
  onChangeStatus: (lead: Lead, status: Status) => void;
}): ReactElement {
  return (
    <aside className="drawer">
      <button type="button" className="drawer-close" onClick={onClose}>
        Fechar
      </button>
      <p className="eyebrow">Detalhes do lead</p>
      <h2>{lead.name}</h2>

      <div className="drawer-contact">
        <a href={`tel:${lead.phone}`}>
          <Phone size={16} />
          {lead.phone || "Sem telefone"}
        </a>
        <a href={`mailto:${lead.email}`}>
          <Mail size={16} />
          {lead.email || "Sem e-mail"}
        </a>
      </div>

      <label className="drawer-field">
        Status
        <select value={lead.status} onChange={(event) => onChangeStatus(lead, event.target.value as Status)}>
          {stages.map((stage) => (
            <option key={stage}>{stage}</option>
          ))}
        </select>
      </label>

      <div className="drawer-meta">
        <article>
          <span>Cidade</span>
          <strong>{lead.city || "Não informada"}</strong>
        </article>
        <article>
          <span>Perfil</span>
          <strong>{lead.profile}</strong>
        </article>
        <article>
          <span>Objetivo</span>
          <strong>{lead.objective}</strong>
        </article>
      </div>

      <h3>Linha do tempo</h3>
      <ol className="timeline">
        {lead.events.map((event) => (
          <li key={event.id}>
            <span>{formatDate(event.created_at)}</span>
            <strong>{event.event_type}</strong>
          </li>
        ))}
      </ol>
    </aside>
  );
}

createRoot(document.getElementById("admin-root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
