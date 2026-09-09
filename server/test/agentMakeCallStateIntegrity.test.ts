import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../tools/index.ts', import.meta.url), 'utf8');
const makeCall = source.slice(source.indexOf('  make_call:'), source.indexOf('  generate_speech_brief:'));

assert.match(makeCall, /INSERT INTO call[\s\S]*status, call_strategy_brief/);
assert.match(makeCall, /status.*'initiated'/);
assert.match(makeCall, /telResult/);
assert.match(makeCall, /status.*'failed'/);
assert.doesNotMatch(makeCall, /status = 'completed'/, 'make_call must not fabricate completed state before provider webhook');
assert.doesNotMatch(makeCall, /Math\.floor\(Math\.random\(\) \* 90\) \+ 45/, 'make_call must not fabricate call duration');
assert.doesNotMatch(makeCall, /recordingUrl = `https:\/\/storage\.googleapis\.com\/vortex-one-recordings/, 'make_call must not fabricate a recording URL');
assert.doesNotMatch(makeCall, /disposition = 'interested'/, 'make_call must not fabricate a disposition');

console.log('agent make_call state integrity tests passed');
