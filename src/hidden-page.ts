// A page nothing on the site links to: a game's WebGL build filling the
// window, kept out of search results and holding the keyboard so the game
// gets every key.

export function frameBuild(buildUrl: string, title: string): void {
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, nofollow";
  document.head.append(robots);
  document.title = title;

  const frame = document.createElement("iframe");
  frame.src = buildUrl;
  frame.title = title;
  frame.allow = "autoplay; fullscreen; gamepad";
  frame.style.cssText = "position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: #000;";
  frame.addEventListener("load", () => frame.focus());
  document.body.style.margin = "0";
  document.body.replaceChildren(frame);
}
