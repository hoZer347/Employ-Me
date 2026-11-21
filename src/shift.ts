// The SHIFT page: the game's WebGL build filling the window, kept out of
// search results and holding the keyboard so the game gets every key.

const BUILD_URL = "/shift/";

const robots = document.createElement("meta");
robots.name = "robots";
robots.content = "noindex, nofollow";
document.head.append(robots);
document.title = "SHIFT";

const frame = document.createElement("iframe");
frame.src = BUILD_URL;
frame.title = "SHIFT";
frame.allow = "autoplay; fullscreen; gamepad";
frame.style.cssText = "position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: #000;";
frame.addEventListener("load", () => frame.focus());
document.body.style.margin = "0";
document.body.replaceChildren(frame);
