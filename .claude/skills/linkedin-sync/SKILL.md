---
name: linkedin-sync
description: Mirror resume changes onto Liam's LinkedIn profile at linkedin.com/in/liambrowndev, driving the real profile forms over Chrome DevTools MCP. Use whenever src/resume.ts changes or the resume tab is edited on the site (public/content-overrides.json), whenever the user asks to update, review, or fix their LinkedIn, and whenever a job, project, skill, or date on the site no longer matches LinkedIn.
---

# LinkedIn sync

The resume is `src/resume.ts` plus the edits made on the site's resume tab,
which the in-page editor saves to `public/content-overrides.json` and not to
`resume.ts`. LinkedIn is a mirror of the two merged, so a change to either is
not finished until the matching LinkedIn field is updated too. Profile: <https://www.linkedin.com/in/liambrowndev/>.

## Before touching anything

1. Run `node tools/resume-json.mjs` and read its output in full. Every string
   you type into LinkedIn comes from there, adapted only for LinkedIn's field
   shapes. A nonzero exit means a site edit no resume field holds: stop and
   ask the user where it belongs.
2. Load the profile in Chrome (see **Driving the forms**) and read what is
   already live. Never overwrite from memory.
3. Diff the two, then list the specific fields you intend to change before
   changing them.

## What must never be invented

LinkedIn is a public factual record. If the resume does not say it and
the live profile does not say it, **ask the user** rather than filling it in.
This has already come up for:

- employment type (full-time vs contract vs co-op),
- postal code, which is the only way to set the city on the profile,
- start dates for open-ended personal projects,
- whether a role has actually ended.

Where the resume and LinkedIn genuinely conflict (education dates have
conflicted before), do not silently pick one. Change nothing and report the
conflict.

## Copy rules

The dash and "Resume" rules in `CLAUDE.md` apply to LinkedIn prose as well.
Use `•` for bullets inside description fields. Bullet text should be the
resume bullets close to verbatim, since they are already written for
screeners.

## Driving the forms

Chrome DevTools MCP, following the browser rules in `CLAUDE.md` (open your
own tab, close only your own tab, never close the last one).

- **Auth.** `WebFetch` on any linkedin.com profile returns HTTP 999, and a
  logged-out tab hits the authwall. The browser sits on a Windows desktop of
  its own and is not on screen at all, so if it is not signed in, open
  <https://www.linkedin.com/login> and ask the user to put that desktop on
  screen and sign in:

  ```
  powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\3hoze\Desktop\website\tools\chrome-desktop.ps1" -Show
  ```

  That desktop has no taskbar, no Alt+Tab, and no terminal, so tell them their
  way back is Ctrl+Alt+Del followed by Cancel. Once they say they are signed in,
  run the same command with `-Hide` to put their desktop back for them.
- **Pacing.** Go slowly, or LinkedIn's bot defences kick in. A run has already
  been bounced to `/feed/` mid-edit for moving too fast. Wait 8 to 12 seconds
  between page navigations and 5 to 7 seconds after each save, with
  `await new Promise(r => setTimeout(r, ms))` inside `evaluate_script`
  (the Bash tool blocks foreground `sleep`).
- **Notify network.** Every position and education form has a "Notify network"
  / "Share with your network" switch. Turn it **off** before saving unless the
  user has asked to announce the change. Editing a job end date with it on
  broadcasts "left their job" to every connection.
- **Never post, comment, connect, or message.** Profile fields only.

### Form URLs

Substitute the current vanity slug (`liambrowndev`).

| Target | URL |
| --- | --- |
| Headline, name, industry, postal code | `/in/<slug>/edit/intro/` |
| About + top 5 skills | `/in/<slug>/edit/forms/summary/new/` |
| One role | `/in/<slug>/edit/forms/position/<positionId>/` |
| Education entry | `/in/<slug>/details/education/edit/forms/<id>/` |
| Project (edit / new) | `/in/<slug>/details/projects/edit/forms/<id>/`, `/in/<slug>/edit/forms/project/new/` |
| Add one skill | `/in/<slug>/skills/edit/forms/new/` |
| Read-only lists (to find ids) | `/in/<slug>/details/{experience,education,skills,projects}/` |
| Custom URL + public visibility | `/public-profile/settings` |

Ids are not stable across accounts: scrape them from the `details/` pages'
edit links rather than hardcoding.

### Widget quirks

These cost real time on the first pass:

- **Typeahead fields** (school, degree, field of study, skill, location) do
  **not** replace on `fill` — they append, producing
  `Bachelor's of ScienceBachelor of Computer Science (Honours)`. Clear to `''`
  and dispatch `input`, wait, then set the real value, wait ~2.5s for
  suggestions, and click the matching `[role=option]` with a `mousedown`
  followed by `click`. The value is not committed until an option is picked.
- **Scope the skill typeahead to the dialog.** The global header search box
  also has `aria-autocomplete="list"`; grabbing the wrong one navigates the
  tab to a search results page mid-run. Filter out the input whose
  placeholder matches `/looking for/`.
- **Description fields differ by form.** The position and project *edit*
  forms use a Quill contenteditable (the `fill` tool works, or
  `document.execCommand('insertText', ...)` after selecting its contents);
  the project *new* form uses a plain `<textarea>`, which needs the native
  value setter plus an `input` event.
- **Edit forms render inline, not in `[role=dialog]`.** Scope queries to the
  page. Reading a position's Quill description back through `innerText` shows
  a blank line between every paragraph; that is one `<p>` per line, not empty
  paragraphs, so compare with newlines collapsed.
- **`<select>`s** need the native `HTMLSelectElement.prototype.value` setter
  plus a `change` event; match options by their visible text. Unchecking "I am
  currently working in this role" makes the end month/year selects appear,
  defaulted to the current month.
- **Skills are one per save.** The suggested-skill checkboxes just populate
  the same input; there is no bulk add. Read `/details/skills/` first so you
  do not re-add what is there.
- **Top 5 skills** live at the bottom of the About form, not in the skills
  section.
- **Featured links** need LinkedIn to generate a preview, and that service
  has failed on every URL tried so far. If "We couldn't generate a preview"
  comes back, back out and tell the user to add it by hand; do not retry in a
  loop.

## Canonical links

Use these exact URLs in profile copy. Getting this wrong has already shipped
a bad link to the live profile.

- **Site: `loomhozer.ca`** — the live site, self-hosted. `liambrown-website.netlify.app`
  is only a mirror and must not be the URL on the profile.
- Code: `github.com/hoZer347` (engine: `github.com/hoZer347/Loom`)
- Games: `hozer347.itch.io`

## Known open items

Carry these forward and re-check them on each sync:

- Location reads "Canada", not Ottawa. Needs the user's postal code in the
  intro form.
- Education dates conflict: LinkedIn says Sep 2017 - Dec 2023, the resume
  says 2017 - 2022.
- The Featured section is still empty (site, itch.io, Loom repo).
- The Education, Skills, and Projects sections do not render on the profile
  page even though the data saves and every public-visibility toggle is on.
  Verify before concluding a section is missing; check `/details/<section>/`.

## After the sync

If the vanity URL changes, update `src/resume.ts` (`contact.linkedin`) and
`src/main.ts` in the same pass. Then report per field what changed, what was
skipped, and why.
