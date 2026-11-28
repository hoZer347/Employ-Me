// Picks which page this load is. Each hidden hash is a page nothing links to,
// so it is only reached by typing it; every other hash is the site as it
// always was. Crossing into or out of one reloads, so no page has to tear
// another down.

const HIDDEN_PAGES: Record<string, () => Promise<unknown>> = {
  "#SHIFT": () => import("./shift"),
  "#trustnoone": () => import("./trustnoone"),
};

const hiddenPage = () => HIDDEN_PAGES[location.hash];
const page = hiddenPage();

window.addEventListener("hashchange", () => {
  if (hiddenPage() !== page) location.reload();
});

void (page ? page() : import("./main"));
