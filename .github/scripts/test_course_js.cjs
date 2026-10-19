// Unit tests for the pure helpers in assets/js/course.js (schedule dates, next meeting, deadlines,
// stepper). Run from the repository root: node --test .github/scripts/test_course_js.cjs
// With a built site (SITE_DIR, default _site) it also parses the rendered home-page calendar and
// deadlines tables, which the home-page board reads.
const assert = require('node:assert/strict');
const {existsSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');

const SOURCE = join(__dirname, '../../assets/js/course.js');
const course = require(SOURCE);
const {
  courseDate, daysUntil, dueLabel, israelRuleOffsetMinutes, nextDeadlineIndex, nextMeetingIndex, parseDeadline,
  parseScheduleDate, stepperIndex, zoneOffsetMinutes,
} = course;

const utc = text => Date.parse(text);

// The README calendar (Date column), in order.
const CALENDAR = [
  'Mon 19 Oct 2026, 18:00', 'Mon 26 Oct 2026', 'Mon 2 Nov 2026', 'Mon 9 Nov 2026', 'Mon 16 Nov 2026',
  'Mon 23 Nov 2026', 'Mon 30 Nov 2026', 'Mon 7 Dec 2026', 'Mon 14 Dec 2026', 'Mon 21 Dec 2026',
  'Mon 28 Dec 2026', 'Mon 4 Jan 2027', 'Mon 11 Jan 2027',
];
const meetings = CALENDAR.map(parseScheduleDate);

// The README assignments table (Deadline column), in order: EX1, EX2, EX3, open-source evidence.
const DEADLINES = ['Mon 9 Nov 2026', 'Mon 30 Nov 2026', 'Mon 11 Jan 2027', 'Mon 11 Jan 2027'];
const deadlines = DEADLINES.map(parseDeadline);

test('loads without a DOM and exports only pure helpers', () => {
  const exported = Object.keys(course).sort();
  assert.deepEqual(exported, [
    'courseDate', 'daysUntil', 'dueLabel', 'israelRuleOffsetMinutes', 'nextDeadlineIndex', 'nextMeetingIndex',
    'parseDeadline', 'parseScheduleDate', 'stepperIndex', 'zoneOffsetMinutes',
  ]);
});

test('parses a meeting with an explicit time in Israel summer time (UTC+3)', () => {
  assert.deepEqual(parseScheduleDate('Mon 19 Oct 2026, 18:00'), {
    date: '2026-10-19', hour: 18, minute: 0, time: utc('2026-10-19T15:00:00Z'),
  });
});

test('a date without a time means the regular 16:00 meeting, in winter time (UTC+2)', () => {
  assert.deepEqual(parseScheduleDate('Mon 26 Oct 2026'), {
    date: '2026-10-26', hour: 16, minute: 0, time: utc('2026-10-26T14:00:00Z'),
  });
  assert.equal(parseScheduleDate('Mon 11 Jan 2027').time, utc('2027-01-11T14:00:00Z'));
});

test('tolerates extra whitespace from rendered table cells', () => {
  assert.equal(parseScheduleDate('  Mon  2 Nov 2026 \n').date, '2026-11-02');
  assert.equal(parseScheduleDate('Mon 19 Oct 2026,18:00').hour, 18);
});

test('rejects text that is not a schedule date', () => {
  for (const text of ['', null, undefined, 'TBD', '19 Oct 2026', 'Mon 19 October 2026', 'Mon 31 Nov 2026',
    'Mon 19 Oct 2026, 24:00', 'Mon 19 Oct 2026, 18:60', 'Mon 19 Oct 2026 18:00', 'Mon 19 Okt 2026']) {
    assert.equal(parseScheduleDate(text), null, String(text));
  }
});

test('a weekday that does not match its date is a typo, not a date', () => {
  assert.equal(parseScheduleDate('Tue 19 Oct 2026, 18:00'), null);
  assert.equal(parseScheduleDate('Mon 27 Oct 2026'), null);
  assert.equal(parseDeadline('Mon 10 Nov 2026'), null);
  assert.equal(parseDeadline('Tue 10 Nov 2026').date, '2026-11-10');
});

test('a deadline date means 23:59 Israel time on that day', () => {
  assert.deepEqual(parseDeadline('Mon 9 Nov 2026'), {
    date: '2026-11-09', hour: 23, minute: 59, time: utc('2026-11-09T21:59:00Z'),
  });
  assert.equal(parseDeadline('Mon 11 Jan 2027').time, utc('2027-01-11T21:59:00Z'));
  assert.equal(parseDeadline(' Mon  30 Nov 2026\n').date, '2026-11-30');
  assert.equal(parseDeadline('Mon 9 Nov 2026, 12:00').hour, 12, 'an explicit time wins');
  for (const text of ['', null, 'TBD', '9 Nov 2026', 'Mon 9 November 2026', 'Mon 31 Nov 2026']) {
    assert.equal(parseDeadline(text), null, String(text));
  }
});

test('23:59 on either side of the 25 October clock change', () => {
  assert.equal(parseDeadline('Sat 24 Oct 2026').time, utc('2026-10-24T20:59:00Z')); // IDT, UTC+3
  assert.equal(parseDeadline('Sun 25 Oct 2026').time, utc('2026-10-25T21:59:00Z')); // IST, UTC+2
});

test('every README deadline parses, in order', () => {
  deadlines.forEach((deadline, index) => assert.ok(deadline, DEADLINES[index]));
  for (let i = 1; i < deadlines.length; i++) assert.ok(deadlines[i].time >= deadlines[i - 1].time);
});

test('every README calendar date parses, in increasing order', () => {
  meetings.forEach((meeting, index) => assert.ok(meeting, CALENDAR[index]));
  for (let i = 1; i < meetings.length; i++) assert.ok(meetings[i].time > meetings[i - 1].time);
});

test('the course calendar day follows Israel time, not UTC', () => {
  assert.equal(courseDate(utc('2026-10-19T20:59:59Z')), '2026-10-19'); // 23:59:59 IDT
  assert.equal(courseDate(utc('2026-10-19T21:00:00Z')), '2026-10-20'); // 00:00 IDT
  assert.equal(courseDate(utc('2026-10-26T21:59:59Z')), '2026-10-26'); // 23:59:59 IST
  assert.equal(courseDate(utc('2026-10-26T22:00:00Z')), '2026-10-27'); // 00:00 IST
});

test('Israel clocks go back at 02:00 on Sunday 25 October 2026', () => {
  assert.equal(zoneOffsetMinutes(utc('2026-10-24T22:59:59Z')), 180);
  assert.equal(zoneOffsetMinutes(utc('2026-10-24T23:00:00Z')), 120);
  assert.equal(zoneOffsetMinutes(utc('2027-03-25T23:59:59Z')), 120); // spring 2027: Friday 26 March
  assert.equal(zoneOffsetMinutes(utc('2027-03-26T00:00:00Z')), 180);
});

test('the built-in Israel rule matches the time-zone database around both changes', () => {
  const instants = [
    '2026-03-26T23:59:59Z', '2026-03-27T00:00:00Z', '2026-10-24T22:59:59Z', '2026-10-24T23:00:00Z',
    '2026-12-14T14:00:00Z', '2027-03-25T23:59:59Z', '2027-03-26T00:00:00Z', '2027-07-01T12:00:00Z',
  ];
  for (const text of instants) assert.equal(israelRuleOffsetMinutes(utc(text)), zoneOffsetMinutes(utc(text)), text);
});

test('without time-zone data the rule fallback gives the same meeting times', () => {
  let calls = 0;
  const stub = {DateTimeFormat: function DateTimeFormat() { calls++; throw new RangeError('no time zones'); }};
  const sandbox = {exports: {}};
  // A parameter named Intl shadows the built-in inside course.js.
  new Function('module', 'Intl', readFileSync(SOURCE, 'utf8'))(sandbox, stub);
  const fallback = sandbox.exports;
  assert.equal(fallback.parseScheduleDate('Mon 19 Oct 2026, 18:00').time, utc('2026-10-19T15:00:00Z'));
  assert.equal(fallback.parseScheduleDate('Mon 26 Oct 2026').time, utc('2026-10-26T14:00:00Z'));
  assert.equal(fallback.nextMeetingIndex(CALENDAR.map(fallback.parseScheduleDate), utc('2026-10-25T22:30:00Z')), 1);
  assert.equal(fallback.parseDeadline('Mon 9 Nov 2026').time, utc('2026-11-09T21:59:00Z'));
  assert.equal(fallback.daysUntil('2026-11-09', utc('2026-10-19T05:00:00Z')), 21);
  assert.equal(fallback.daysUntil('2026-11-09', utc('2026-10-25T21:59:59Z')), 15);
  assert.ok(calls > 0, 'the stubbed Intl.DateTimeFormat must have been tried first');
});

test('before the semester the first meeting is next', () => {
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-17T09:00:00Z')), 0);
});

test('a meeting stays next for its whole day in Israel', () => {
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-19T17:00:00Z')), 0); // 20:00 IDT, after the start
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-19T20:59:59Z')), 0);
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-19T21:00:00Z')), 1); // midnight IDT
});

test('across the 25 October clock change the next meeting is 26 October', () => {
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-24T22:30:00Z')), 1); // 01:30 IDT Sunday
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-25T21:59:59Z')), 1); // 23:59:59 IST Sunday
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-26T21:59:59Z')), 1); // 23:59:59 IST Monday
  assert.equal(nextMeetingIndex(meetings, utc('2026-10-26T22:00:00Z')), 2); // 00:00 IST Tuesday
});

test('the year boundary and the last meeting', () => {
  assert.equal(nextMeetingIndex(meetings, utc('2026-12-31T22:00:00Z')), 11); // 1 Jan 2027 → 4 Jan
  assert.equal(nextMeetingIndex(meetings, utc('2027-01-11T21:59:59Z')), 12);
  assert.equal(nextMeetingIndex(meetings, utc('2027-01-11T22:00:00Z')), -1);
});

test('unparseable rows are skipped, and an empty calendar has no next meeting', () => {
  const withGaps = [null, parseScheduleDate('Mon 26 Oct 2026'), null];
  assert.equal(nextMeetingIndex(withGaps, utc('2026-10-17T09:00:00Z')), 1);
  assert.equal(nextMeetingIndex([], utc('2026-10-17T09:00:00Z')), -1);
  assert.equal(nextMeetingIndex([null], utc('2026-10-17T09:00:00Z')), -1);
});

test('before the semester the first deadline is EX1', () => {
  const now = utc('2026-10-17T09:00:00Z');
  assert.equal(nextDeadlineIndex(deadlines, now), 0);
  assert.equal(daysUntil(deadlines[0].date, now), 23);
});

test('on the morning of 19 October, EX1 is due in 21 days', () => {
  const now = utc('2026-10-19T05:00:00Z'); // 08:00 IDT
  assert.equal(nextDeadlineIndex(deadlines, now), 0);
  assert.equal(daysUntil('2026-11-09', now), 21);
  assert.equal(dueLabel(daysUntil('2026-11-09', now)), 'in 21 days');
  assert.equal(daysUntil('2026-11-09', utc('2026-10-19T20:59:59Z')), 21); // 23:59:59 IDT
  assert.equal(daysUntil('2026-11-09', utc('2026-10-19T21:00:00Z')), 20); // midnight IDT
});

test('days count Israel calendar days across the 25 October clock change', () => {
  assert.equal(daysUntil('2026-11-09', utc('2026-10-24T20:59:59Z')), 16); // 23:59:59 IDT Saturday
  assert.equal(daysUntil('2026-11-09', utc('2026-10-24T22:30:00Z')), 15); // 01:30 IDT Sunday
  assert.equal(daysUntil('2026-11-09', utc('2026-10-24T23:30:00Z')), 15); // 01:30 IST, the hour repeats
  assert.equal(daysUntil('2026-11-09', utc('2026-10-25T21:59:59Z')), 15); // 23:59:59 IST Sunday
  assert.equal(daysUntil('2026-11-09', utc('2026-10-25T22:00:00Z')), 14); // 00:00 IST Monday
});

test('a deadline stays next, and "today", until 23:59:59 Israel time', () => {
  assert.equal(dueLabel(daysUntil('2026-11-09', utc('2026-11-08T10:00:00Z'))), 'tomorrow');
  for (const text of ['2026-11-08T22:00:00Z', '2026-11-09T16:00:00Z', '2026-11-09T21:59:59Z']) {
    assert.equal(nextDeadlineIndex(deadlines, utc(text)), 0, text);
    assert.equal(dueLabel(daysUntil(deadlines[0].date, utc(text))), 'today', text);
  }
  assert.equal(nextDeadlineIndex(deadlines, utc('2026-11-09T22:00:00Z')), 1); // 00:00 Tuesday
});

test('two hand-ins on one day: the first row is next, both share its time', () => {
  const index = nextDeadlineIndex(deadlines, utc('2026-12-01T10:00:00Z'));
  assert.equal(index, 2);
  assert.equal(deadlines[3].time, deadlines[index].time);
});

test('after 11 January 2027 there is no next deadline', () => {
  assert.equal(nextDeadlineIndex(deadlines, utc('2027-01-11T21:59:59Z')), 2);
  assert.equal(nextDeadlineIndex(deadlines, utc('2027-01-11T22:00:00Z')), -1);
  assert.equal(nextDeadlineIndex(deadlines, utc('2027-03-01T10:00:00Z')), -1);
});

test('an unreadable or empty deadlines table names no deadline', () => {
  const now = utc('2026-10-19T05:00:00Z');
  assert.equal(nextDeadlineIndex([deadlines[0], null, deadlines[2]], now), -1);
  assert.equal(nextDeadlineIndex([], now), -1);
  assert.equal(nextDeadlineIndex([parseDeadline('Mon 30 Nov 2026'), parseDeadline('Mon 9 Nov 2026')], now), 1,
    'the earliest open deadline wins, whatever the row order');
});

test('relative due labels', () => {
  assert.equal(dueLabel(0), 'today');
  assert.equal(dueLabel(1), 'tomorrow');
  assert.equal(dueLabel(21), 'in 21 days');
  for (const days of [-1, 1.5, NaN, undefined, '3']) assert.equal(dueLabel(days), '', String(days));
  assert.ok(Number.isNaN(daysUntil('9 Nov 2026', utc('2026-10-19T05:00:00Z'))));
  assert.equal(daysUntil('2026-10-18', utc('2026-10-19T05:00:00Z')), -1);
});

test('the stepper never moves past its first or last step', () => {
  assert.equal(stepperIndex(0, 1, 3), 1);
  assert.equal(stepperIndex(1, 1, 3), 2);
  assert.equal(stepperIndex(2, 1, 3), 2);
  assert.equal(stepperIndex(0, -1, 3), 0);
  assert.equal(stepperIndex(2, -1, 3), 1);
  assert.equal(stepperIndex(9, 0, 3), 2);
  assert.equal(stepperIndex(-4, 0, 3), 0);
});

test('the stepper copes with degenerate input', () => {
  assert.equal(stepperIndex(0, 1, 1), 0);
  assert.equal(stepperIndex(0, 1, 0), 0);
  assert.equal(stepperIndex(0, 1, -2), 0);
  assert.equal(stepperIndex(NaN, 1, 3), 1);
  assert.equal(stepperIndex(1, NaN, 3), 1);
  assert.equal(stepperIndex(1.7, 1, 3), 2);
  assert.equal(stepperIndex(0, 1, 2.5), 0);
});

const home = join(process.env.SITE_DIR || '_site', 'index.html');
test('the rendered home-page calendar parses, one date per row', {skip: !existsSync(home) && 'no built site'}, () => {
  const html = readFileSync(home, 'utf8');
  const table = html.match(/<table class="schedule">([\s\S]*?)<\/table>/);
  assert.ok(table, 'index.html needs table.schedule (from _plugins/course_components.rb)');
  const dates = [...table[1].matchAll(/<td data-label="Date">([\s\S]*?)<\/td>/g)].map(match => match[1].replace(/<[^>]+>/g, ''));
  assert.equal(dates.length, 13);
  dates.forEach(text => assert.ok(parseScheduleDate(text), `unparseable schedule date: ${text}`));
});

test('the rendered deadlines table parses, and on 19 October names EX1', {skip: !existsSync(home) && 'no built site'}, () => {
  const html = readFileSync(home, 'utf8');
  const table = html.match(/<table class="deadlines">([\s\S]*?)<\/table>/);
  assert.ok(table, 'index.html needs table.deadlines (from _plugins/course_components.rb)');
  const text = cell => cell.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const headers = [...table[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(match => text(match[1]).toLowerCase());
  const what = headers.indexOf('assignment'), when = headers.indexOf('deadline');
  assert.ok(what >= 0 && when >= 0, `course.js reads the Assignment and Deadline columns: ${headers}`);
  const body = table[1].slice(table[1].indexOf('<tbody>'));
  const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map(match => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell => text(cell[1])));
  assert.equal(rows.length, 4);
  const parsed = rows.map(row => parseDeadline(row[when]));
  parsed.forEach((deadline, index) => assert.ok(deadline, `unparseable deadline: ${rows[index][when]}`));
  const now = utc('2026-10-19T05:00:00Z');
  const next = nextDeadlineIndex(parsed, now);
  assert.equal(rows[next][what], 'EX1 — Backend');
  assert.equal(dueLabel(daysUntil(parsed[next].date, now)), 'in 21 days');
});
