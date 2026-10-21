# Packing Slip Explainer Insert — Plan

A printed insert that goes in every shipment next to the packing slip: how to choose wines for an occasion using the slip, seasonal occasion examples (switched by Hebrew date), a short glossary, and an Evyatar greeting with a WhatsApp QR. A companion blog post presents the same content to people who haven't ordered yet; the FAQ points to it. Status: **English copy drafted and placed in the library (2026-10-21): `template-packing-insert`, `template-packing-insert-seasons`, `blog-whats-in-the-box` (Title + Body), and the FAQ (`blog-faq`, with the "What's in the Box" section); calendar rows and tasks set up by the admin (FAQ carries its email). Next: Evyatar edits, manager translates.** The packing slip itself is unchanged.

## Why

The packing slip is a trust device ("We put our reputation on every packing slip," `website/WEBSITE_STRATEGY.md`), but nothing in the box explains its scales and pairing lines. A customer holding the slip should be able to use it in a minute, without feeling they have to learn a system (`content/CLAUDE.md`). Shown on the site, the same guide is a selling point.

## What the slip prints (`PrintService.js`)

Bilingual, English and Hebrew side by side; header with date, order number, name, address, phone; no prices. Per wine: name; `Harmonize with: …` and `Contrast with: …` lines (text pre-formatted by `PackingSlipService`, food types mild / rich / intense / sweet); `Recommended decanting – N minutes.` when set; then one line of labeled text scales, e.g. `Intensity ●●●○○  Complexity ●●●●○` (filled ● / empty ○ out of five). Reds show Intensity + Complexity, whites and rosés Complexity + Acidity. Total bottle count at the bottom.

## The insert (English; manager translates)

One page, bilingual like the slip. Sections, in order:

**1. How to use your packing slip (agreed draft, 2026-10-21).** Leads with the characteristics, then pairings, because dry-red pairing lines are fairly repetitive and the scales are what tell wines apart:

> Every wine on your slip has a few simple markers. Reds show **Intensity** and **Complexity**, and a note if the wine likes some air before serving. Whites and rosés show **Complexity** and **Acidity**. Every wine also lists the types of food it harmonizes or contrasts with.
>
> Start with the occasion. If it's built around a meal, let the menu lead, along with the weather and the time of day:
> - **Bold, layered dishes:** reach for more intense, complex wines.
> - **Lighter dishes:** less intense wines harmonize, more intense ones contrast.
> - **Citrusy or spicy:** lower-acid whites and rosés.
> - **Creamy or rich:** higher-acid whites and rosés.
>
> Bringing a gift for the host, or not sure about the menu or your guests' tastes? A moderate wine, or a few wines with different characters, will find favor.
>
> Then check the food types on the slip, and off you go.

**2. Seasonal occasion examples.** Switched by Hebrew date (see Seasons). Rules (user, 2026-10-21):
- Four or five short lines per season, very cultural and seasonal: Shabbat evening, Shabbat day, the holiday by name, everyday, gift. Aim for one meat meal, one dairy/fish/veg, one casual or gift.
- Very general: never a specific wine or package.
- No sweet desserts (e.g. sufganiyot): they don't pair with dry wines. For Rosh Hashanah, stick to the main meal.
- Each line is plain text, then a slip-style line using the slip's own characters and wording, so it maps straight onto the slip.

Agreed sample:

> **This season: Hanukkah**
>
> **Shabbat evening:** chicken soup and a roast, with a medium red or a fuller white.
> Intensity ●●●○○ · Complexity ●●●○○ · Harmonize with: rich flavors
>
> **Shabbat day:** a slow-cooked cholent wants a bold, layered red. Open it early.
> Intensity ●●●●○ · Complexity ●●●●○ · Recommended decanting
>
> **Hanukkah:** latkes and the traditional cheese dishes, with a crisp white or rosé.
> Acidity ●●●●○ · Contrast with: rich flavors
>
> **Everyday:** a winter weeknight pasta or hearty soup, with an easygoing red.
> Intensity ●●●○○ · Harmonize with: mild flavors
>
> **Gift:** candle-lighting at friends'? Something in the middle suits any table.
> Intensity ●●●○○ · Complexity ●●●○○

Slip-style lines use the slip's font/size on the printed insert. Pairing wording must match `PackingSlipService` output exactly (check before final copy).

**3. Glossary.** What the scales mean (more circles = more of it), Harmonize vs Contrast and the four food types, the decanting note, and that a gift recipient gets the same slip without prices. Wording can draw on `/red-wine-intensity/`, `/wine-complexity/`, `/white-rose-wine-acidity/`, `/pairing-food-and-wine/`, `/how-to-store-open-serve-wine/`.

**4. Greeting + QR.** A short, year-round (neutral) note from Evyatar, starting from "A note from Evyatar" in `website/HOMEPAGE_COPY.md`, beside a QR that opens the business WhatsApp (`https://wa.me/972555174805`).

## Copy in the library

Two `template` entries, each with EN/HE siblings, worked through Draft, Edit, Translate, Edit Translation (template has no pre-checked chain in the create dialog; tick those stages). Candidate slugs:

1. `template-packing-insert`: the full insert text with one seasonal set as the sample. Also the source for the blog post.
2. `template-packing-insert-seasons`: all eight seasonal sets in one Doc, so the manager edits and translates them together.

## Print templates and rotation (user, 2026-10-21)

**Eight complete print templates**, one per season, each two-sided: English on one side, Hebrew on the other. No placeholders and no season text in config: each template is the finished page, so a longer or shorter seasonal section can't break the layout, and a wording change is a Doc edit with no deploy. Shared parts (intro, glossary, greeting) repeat across the eight; they should rarely change.

**A session builds the eight** from the two locked library Docs; the method is decided in that session.

**jlmops only chooses the template.** When a batch's packing slips are generated, it works out the season from the Hebrew date, copies that season's template into the output folder, and the insert is printed double-sided once per order, right after the slips. The templates live in the jlmops print templates folder (`1dUSbbkNCrGbVUpZnmoa0D_e5zib9HaXe`). The insert is a separate document because `PrintService.js` copies the slip template, clears its body and rebuilds every slip in code.

## Seasons

The seasonal section is the reason for the Hebrew-date conversion. Proposed start dates (candidate, awaiting confirmation): 1 Elul High Holidays; 23 Tishrei Autumn; 1 Kislev Hanukkah; 3 Tevet Winter / Tu Bishvat; 1 Adar (Adar II in a leap year) Purim; 15 Adar (Adar II) Pesach; 23 Nisan Spring / BBQ / Shavuot; 7 Sivan Summer. A leap year only lengthens Winter. How jlmops maps a season to its template (config table of start dates and Doc IDs, or Docs named by season in one folder) is decided at build.

**Mechanics.** Apps Script converts natively: `Intl.DateTimeFormat('en-u-ca-hebrew', {timeZone: 'Asia/Jerusalem'})` with `formatToParts` gives Hebrew day/month/year and distinguishes Adar I / Adar II (verified in the live GAS runtime, 2026-10-21). No lookup table.

**Related, later:** `CrmIntelligenceService.js` holiday reminders use fixed approximate Gregorian dates; the same conversion could replace them. Separate task.

## Blog post

Nearly the insert itself, with a short frame: your order has arrived, look for the packing slip, it has details on every wine that make it easy to match to the occasion; don't worry, this simple guide is in the box too. Then the insert's sections, each with a one-line lead-in; the seasonal part explained in detail with one season as a sample (static text). Illustrated with photos of the real insert and a slip (test order or blurred; QR legible). Title candidates: "When Your Wine Arrives," "Enjoying Your Wine When the Order Arrives." Possibly sticky (check the theme first). The insert copy is the master; the post is its own blog chain, including its email.

## FAQ entry

A new section headed **"What's in the Box"** (when your order arrives, and after); long answer points to the blog post, short mention of the seasonal examples. A single task, no chain or email, added once the post exists. (The full FAQ launch is separate, with its own chain and email: tracked in `.claude/wishlist.md`.)

## Open points

- Remaining seasons' examples (draft next, in chat).
- Season start dates.
- Glossary and greeting copy.

## Build order

1. Finish English copy in chat (seasons, glossary, greeting), then into the two library entries; manager edits.
2. Manager translates to Hebrew.
3. A session builds the eight two-sided print templates (QR, slip-style lines).
4. jlmops rotation: Hebrew-date season picker, copy that season's template with each slip batch (jlmops deploy, needs explicit OK).
5. Blog post chain from the insert copy, with photos and its email.
6. FAQ "What's in the Box" entry (single task).
