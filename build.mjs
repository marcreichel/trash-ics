import { mkdirSync, writeFileSync } from 'node:fs';

// Haan waste calendar for "Ellscheider Straße": Biomüll, Blaue Tonne, Gelber Sack, Restmüll.
const SOURCE = 'https://www.haan.de/output/options.php?ModID=48&call=ical&ArtID%5B0%5D=3431.3&ArtID%5B1%5D=3431.2&ArtID%5B2%5D=3431.4&ArtID%5B3%5D=3431.1&pois=3431.138&jahr=';

const TITLES = {
    'Biomüll': '🍎 Biomüll',
    'Gelber Sack': '♻️ Gelber Sack',
    'Restmüll': '🚮 Restmüll',
    'Blaue Tonne': '📦 Blaue Tonne',
};

const year = new Date().getFullYear();

async function fetchEvents(y) {
    const res = await fetch(SOURCE + y);
    if (!res.ok) throw new Error(`haan.de ${y}: HTTP ${res.status}`);
    // unfold continuation lines, then pull out VEVENT fields
    const text = (await res.text()).replace(/\r?\n[ \t]/g, '');
    return [...text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map(([, body]) => {
        const field = (name) => body.match(new RegExp(`^${name}[^:\\n]*:(.*?)\\r?$`, 'm'))?.[1];
        const summary = field('SUMMARY').trim();
        return { uid: field('UID'), date: field('DTSTART').slice(0, 8), title: TITLES[summary] ?? summary };
    });
}

const nextDay = (d) => {
    const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1));
    return t.toISOString().slice(0, 10).replaceAll('-', '');
};

const current = await fetchEvents(year);
if (current.length === 0) throw new Error(`No events for ${year}, refusing to publish`);
// ponytail: next year is an empty calendar until the city publishes it
const events = [...current, ...(await fetchEvents(year + 1))].sort((a, b) => a.date.localeCompare(b.date));

const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//marcreichel//trash-ics//DE', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Abfallkalender', 'NAME:Abfallkalender',
    ...events.flatMap((e) => [
        'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`, `SUMMARY:${e.title}`,
        `DTSTART;VALUE=DATE:${e.date}`, `DTEND;VALUE=DATE:${nextDay(e.date)}`, 'END:VEVENT',
    ]),
    'END:VCALENDAR',
];

mkdirSync('public', { recursive: true });
writeFileSync('public/abfall.ics', lines.join('\r\n') + '\r\n');
console.log(`Wrote ${events.length} events`);
