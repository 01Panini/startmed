import { isSupabaseConfigured, supabase } from "./lib/supabase";

type StoredEvent = {
  id: number;
  lead_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const storageKey = "startmed_funnel_events";
let leadId = sessionStorage.getItem("startmed_lead_id") || crypto.randomUUID();
sessionStorage.setItem("startmed_lead_id", leadId);
let leadData: Record<string, string> = {};

async function track(eventType: string, payload: Record<string, unknown> = {}) {
  const event: StoredEvent = {
    id: Date.now(),
    lead_id: leadId,
    event_type: eventType,
    payload: { ...leadData, ...payload, lead_source: "Landing StartMed" },
    created_at: new Date().toISOString(),
  };
  const current = JSON.parse(localStorage.getItem(storageKey) || "[]") as StoredEvent[];
  localStorage.setItem(storageKey, JSON.stringify([...current, event]));
  window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("startmed_funnel_events").insert({
      lead_id: event.lead_id,
      event_type: event.event_type,
      payload: event.payload,
    });
    if (error) console.warn("StartMed event sync failed", error.message);
  }
}

const leadForm = document.querySelector<HTMLFormElement>("#leadForm")!;
const quizForm = document.querySelector<HTMLFormElement>("#quizForm")!;
const resultPanel = document.querySelector<HTMLElement>("#resultPanel")!;
const stepLabel = document.querySelector<HTMLElement>("#stepLabel")!;
const stepTitle = document.querySelector<HTMLElement>("#stepTitle")!;
const progressBar = document.querySelector<HTMLElement>("#progressBar")!;

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector<HTMLElement>("#formMessage")!;
  if (!leadForm.reportValidity()) {
    message.textContent = "Revise os campos obrigatórios para continuar.";
    return;
  }
  const data = new FormData(leadForm);
  leadData = Object.fromEntries(["nome", "whatsapp", "email", "cidade"].map((key) => [key, String(data.get(key) || "").trim()]));
  await track("lead_created", { consentimento: true });
  leadForm.hidden = true;
  quizForm.hidden = false;
  stepLabel.textContent = "Passo 2 de 3";
  stepTitle.textContent = "Seu momento";
  progressBar.style.width = "66%";
});

quizForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector<HTMLElement>("#quizMessage")!;
  if (!quizForm.reportValidity()) {
    message.textContent = "Escolha uma opção em cada pergunta.";
    return;
  }
  const data = new FormData(quizForm);
  const quiz = { momento: String(data.get("momento")), objetivo: String(data.get("objetivo")) };
  await track("quiz_completed", quiz);
  quizForm.hidden = true;
  resultPanel.hidden = false;
  stepLabel.textContent = "Passo 3 de 3";
  stepTitle.textContent = "Sua direção";
  progressBar.style.width = "100%";
});

document.querySelector("#meetingButton")?.addEventListener("click", async () => {
  await track("meeting_requested");
  document.querySelector<HTMLElement>("#resultMessage")!.textContent = "Perfeito. Recebemos seu interesse e entraremos em contato.";
});

document.querySelector("#laterButton")?.addEventListener("click", async () => {
  await track("lead_not_interested");
  document.querySelector<HTMLElement>("#resultMessage")!.textContent = "Tudo certo. Seu perfil ficará salvo para quando quiser retomar.";
});

document.querySelectorAll<HTMLInputElement>('input[name="whatsapp"]').forEach((input) => {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 11);
    input.value = digits.length > 10
      ? digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3")
      : digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible"));
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

const cookie = document.querySelector<HTMLElement>("#cookieBanner")!;
if (localStorage.getItem("startmed_cookie_ack")) cookie.hidden = true;
document.querySelector("#cookieAccept")?.addEventListener("click", () => {
  localStorage.setItem("startmed_cookie_ack", "true");
  cookie.hidden = true;
});
