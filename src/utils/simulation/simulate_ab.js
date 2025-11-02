"use strict";
exports.__esModule = true;
exports.makeSessions = void 0;
var types_1 = require("./types");
// ------ seeded RNG to reuse identical inputs across A/B ------
function mulberry32(seed) {
    return function () {
        var t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// helpers
function randInt(rng, a, b) {
    return a + Math.floor(rng() * (b - a + 1));
}
function randFloat(rng, a, b) {
    if (a === void 0) { a = 0; }
    if (b === void 0) { b = 1; }
    return a + rng() * (b - a);
}
function makeSessions(numSessions, seed) {
    if (seed === void 0) { seed = 42; }
    var rng = mulberry32(seed);
    var sessions = [];
    for (var i = 0; i < numSessions; i++) {
        // axis scores (0..100), allow mild skew by difficulty later
        var axes = types_1.AXIS_KEYS.reduce(function (acc, k) {
            acc[k] = Math.round(randFloat(rng, 40, 98)); // keep in a realistic range
            return acc;
        }, {});
        // per-axis coverage (0..1), some axes seen less in a session
        var coverage = types_1.AXIS_KEYS.reduce(function (acc, k) {
            var seen = randFloat(rng, 0.5, 1.0); // half to full coverage
            acc[k] = +seen.toFixed(2);
            return acc;
        }, {});
        // teacher/test config sampled
        var difficulty = randInt(rng, 1, 3);
        var testConfig = {
            operation: ["add", "sub", "mul", "div", "mix"][randInt(rng, 0, 4)],
            numberRange: [0, [10, 100, 1000][difficulty - 1]],
            steps: randInt(rng, 1, difficulty === 3 ? 3 : 2),
            carryBorrow: !!randInt(rng, 0, 1),
            difficulty: difficulty
        };
        sessions.push({ axes: axes, coverage: coverage, testConfig: testConfig });
    }
    return sessions;
}
exports.makeSessions = makeSessions;
