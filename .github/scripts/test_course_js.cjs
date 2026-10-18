// Unit tests for the pure helpers in assets/js/course.js (schedule dates, next meeting, stepper).
// Run from the repository root: node --test .github/scripts/test_course_js.cjs
// With a built site (SITE_DIR, default _site) it also parses the rendered home-page calendar.
const assert = require('node:assert/strict');
const {existsSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');

const SOURCE = join(__dirname, '../../assets/js/course.js');
const course = require(SOURCE);
const {courseDate, israelRuleOffsetMinutes, nextMeetingIndex, parseScheduleDate, stepperIndex, zoneOffsetMinutes} = course;

const utc = text => Date.parse(text);

// The README calendar (Date column), in order.
const CALENDAR = [
  'Mon 19 Oct 2026, 18:00', 'Mon 26 Oct 2026', 'Mon 2 Nov 2026', 'Mon 9 Nov 2026', 'Mon 16 Nov 2026',
  'Mon 23 Nov 2026', 'Mon 30 Nov 2026', 'Mon 7 Dec 2026', 'Mon 14 Dec 2026', 'Mon 21 Dec 2026',
  'Mon 28 Dec 2026', 'Mon 4 Jan 2027', 'Mon 11 Jan 2027',
];
const meetings = CALENDAR.map(parseScheduleDate);

test('loads without a DOM and exports only pure helpers', () => {
  const exported = Object.keys(course).sort();
  assert.deepEqual(exported, ['courseDate', 'israelRuleOffsetMinutes', 'nextMeetingIndex', 'parseScheduleDate', 'stepperIndex', 'zoneOffsetMinutes']);
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
