// Picks which page this load is. loomhozer.ca#SHIFT is a page nothing links
// to, so it is only reached by typing it; every other hash is the site as it
// always was. Crossing into or out of it reloads, so neither page has to tear
// the other down.

const SECRET_HASH = "#SHIFT";

const isSecret = () => location.hash === SECRET_HASH;
const secret = isSecret();

window.addEventListener("hashchange", () => {
  if (isSecret() !== secret) location.reload();
});

void (secret ? import("./shift") : import("./main"));
