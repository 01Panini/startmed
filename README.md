# StartMed

Landing de captação e CRM operacional da StartMed, construídos com Vite, React e integração opcional com Supabase.

## Rodar localmente

```bash
npm install
npm run dev
```

- Landing: http://127.0.0.1:5173/
- CRM: http://127.0.0.1:5173/admin

Sem variáveis de ambiente, os leads ficam no `localStorage` do navegador e o CRM abre em modo demonstração. Para persistência real, copie `.env.example` para `.env`, informe o URL e a publishable key do projeto Supabase e execute `supabase/startmed_schema.sql` no SQL Editor.

Nunca use uma `service_role` no frontend.
