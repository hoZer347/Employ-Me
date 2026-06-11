import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <main class="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-950 text-slate-100 px-6 text-center">
    <h1 class="text-4xl sm:text-6xl font-bold tracking-tight">
      Hello, <span class="text-sky-400">world</span>.
    </h1>
    <p class="max-w-md text-slate-400">
      Your Vite + TypeScript + Tailwind site is running. Edit
      <code class="text-sky-300">src/main.ts</code> to get started.
    </p>
    <button id="counter" type="button"
      class="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white transition hover:bg-sky-400 active:scale-95">
      Count: 0
    </button>
  </main>
`;

const button = app.querySelector<HTMLButtonElement>("#counter")!;
let count = 0;
button.addEventListener("click", () => {
  count += 1;
  button.textContent = `Count: ${count}`;
});
